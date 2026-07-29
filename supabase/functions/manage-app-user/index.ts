import { createClient } from 'npm:@supabase/supabase-js@2.110.7';

const APP_URL = 'https://pedidos.mygreencode.es';
const INVITE_REDIRECT_URL = `${APP_URL}/login?mode=invite`;
const RECOVERY_REDIRECT_URL = `${APP_URL}/login`;
const FIRST_ADMIN_EMAIL = 'administracion@mygreencode.es';
const cors = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const callerClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error('Sesión no válida');

    const adminClient = createClient(url, service);
    const { data: caller } = await adminClient
      .from('user_profiles')
      .select('role,active')
      .eq('id', user.id)
      .single();
    if (!caller?.active || caller.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Sin permiso' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const action = String(body.action || 'invite');

    if (action !== 'invite') {
      const targetId = String(body.targetId || '');
      if (!targetId) throw new Error('Usuario obligatorio');
      if (targetId === user.id) throw new Error('No puedes modificar tu propio acceso.');

      const { data: target, error: targetError } = await adminClient
        .from('user_profiles')
        .select('id,email,role,active')
        .eq('id', targetId)
        .single();
      if (targetError || !target) throw new Error('Usuario no encontrado');
      if (target.role === 'superadmin' || target.email === FIRST_ADMIN_EMAIL) {
        throw new Error('El superadministrador principal está protegido.');
      }

      if (action === 'resend-access') {
        const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(targetId);
        if (authError || !authData.user) throw authError || new Error('Usuario de acceso no encontrado');
        if (!authData.user.email_confirmed_at) {
          const { error: confirmError } = await adminClient.auth.admin.updateUserById(targetId, { email_confirm: true });
          if (confirmError) throw confirmError;
        }
        const publicClient = createClient(url, anon);
        const { error: recoveryError } = await publicClient.auth.resetPasswordForEmail(target.email, {
          redirectTo: RECOVERY_REDIRECT_URL
        });
        if (recoveryError) throw recoveryError;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'set-active') {
        const active = body.active === true;
        const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, {
          ban_duration: active ? 'none' : '876000h'
        });
        if (authError) throw authError;
        const { error: profileError } = await adminClient
          .from('user_profiles')
          .update({ active, updated_at: new Date().toISOString() })
          .eq('id', targetId);
        if (profileError) throw profileError;
        return new Response(JSON.stringify({ ok: true, active }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'delete-user') {
        const { error: authError } = await adminClient.auth.admin.deleteUser(targetId);
        if (authError) throw authError;
        await adminClient.from('user_profiles').delete().eq('id', targetId);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      throw new Error('Acción no válida');
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email) throw new Error('Correo obligatorio');

    const displayName = String(body.displayName || '').trim() || email.split('@')[0];
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo: INVITE_REDIRECT_URL
    });
    if (error) throw error;

    await adminClient.from('user_profiles').upsert({
      id: data.user.id,
      email,
      display_name: displayName,
      role: body.role === 'admin' ? 'admin' : 'user',
      permissions: body.permissions || {},
      active: true
    });

    return new Response(JSON.stringify({
      ok: true,
      id: data.user.id,
      redirectTo: INVITE_REDIRECT_URL
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
