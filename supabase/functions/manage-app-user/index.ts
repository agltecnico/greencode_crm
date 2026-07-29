import { createClient } from 'npm:@supabase/supabase-js@2.110.7';

const APP_URL = 'https://pedidos.mygreencode.es';
const INVITE_REDIRECT_URL = `${APP_URL}/login?mode=invite`;
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
