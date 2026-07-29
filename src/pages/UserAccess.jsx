import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  ['administration', 'Administración'], ['stock', 'Stock'], ['tasks', 'Tareas'],
  ['crops', 'Cultivos'], ['harvest', 'Cosecha'], ['planner', 'Planificador'],
  ['traceability', 'Trazabilidad'], ['tv', 'Modo TV'], ['delivery', 'Reparto'],
  ['users', 'Gestión de usuarios']
];
const blankPermissions = Object.fromEntries(MODULES.map(([key]) => [key, false]));

const PermissionChecks = ({ permissions, onChange, disabled = false }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '.55rem' }}>
    {MODULES.map(([key, label]) => <label key={key} style={{ display: 'flex', gap: '.45rem', alignItems: 'center', fontSize: '.82rem', fontWeight: 700 }}>
      <input type="checkbox" disabled={disabled} checked={permissions?.[key] === true} onChange={e => onChange(key, e.target.checked)} /> {label}
    </label>)}
  </div>
);

export default function UserAccess() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', displayName: '', role: 'user', permissions: { ...blankPermissions } });
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState('');

  const load = async () => {
    const { data, error } = await supabase.from('user_profiles').select('*').order('created_at');
    if (error) Swal.fire('Error', error.message, 'error');
    else setUsers(data || []);
  };
  useEffect(() => { load(); }, []);

  const invite = async event => {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('manage-app-user', { body: form });
    setBusy(false);
    if (error || data?.error) return Swal.fire('No se pudo invitar', data?.error || error.message, 'error');
    Swal.fire('Invitación enviada', 'El usuario recibirá un correo para establecer su contraseña.', 'success');
    setForm({ email: '', displayName: '', role: 'user', permissions: { ...blankPermissions } });
    load();
  };

  const save = async user => {
    const { error } = await supabase.from('user_profiles').update({
      display_name: user.display_name,
      role: user.role,
      permissions: user.permissions,
      updated_at: new Date().toISOString()
    }).eq('id', user.id);
    Swal.fire(error ? 'Error' : 'Permisos guardados', error?.message || 'Los cambios ya están activos.', error ? 'error' : 'success');
    if (!error) load();
  };

  const runUserAction = async (user, action) => {
    if (action === 'resend-access') {
      const confirmation = await Swal.fire({
        title: '¿Reenviar acceso?',
        text: `Se enviará un nuevo enlace a ${user.email}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, enviar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb'
      });
      if (!confirmation.isConfirmed) return;
    }

    if (action === 'delete-user') {
      const confirmation = await Swal.fire({
        title: 'Eliminar acceso definitivamente',
        html: `Se eliminará el acceso de <strong>${user.email}</strong>.<br>Escribe el correo completo para confirmar.`,
        input: 'text',
        inputPlaceholder: user.email,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar usuario',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626',
        preConfirm: value => {
          if (String(value || '').trim().toLowerCase() !== user.email.toLowerCase()) {
            Swal.showValidationMessage('El correo no coincide.');
            return false;
          }
          return true;
        }
      });
      if (!confirmation.isConfirmed) return;
    }

    const nextActive = action === 'set-active' ? !user.active : undefined;
    setActionBusy(`${action}-${user.id}`);
    const { data, error } = await supabase.functions.invoke('manage-app-user', {
      body: { action, targetId: user.id, active: nextActive }
    });
    setActionBusy('');
    if (error || data?.error) {
      return Swal.fire('No se pudo completar', data?.error || error.message, 'error');
    }

    const messages = {
      'resend-access': ['Enlace enviado', `Se ha enviado un nuevo acceso a ${user.email}.`],
      'set-active': [nextActive ? 'Usuario activado' : 'Usuario desactivado', nextActive ? 'Ya puede volver a iniciar sesión.' : 'Su acceso ha quedado bloqueado.'],
      'delete-user': ['Usuario eliminado', 'Su acceso y perfil de usuario han sido eliminados.']
    };
    await Swal.fire(messages[action][0], messages[action][1], 'success');
    load();
  };

  if (profile?.role !== 'superadmin') return <div className="premium-card">No tienes permiso para gestionar usuarios.</div>;

  return <div>
    <h2>Usuarios y permisos</h2>
    <form className="premium-card" onSubmit={invite} style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
      <h3 style={{ margin: 0 }}>Invitar usuario</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '.75rem' }}>
        <input className="premium-input" type="email" required placeholder="correo@empresa.es" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className="premium-input" placeholder="Nombre" value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
        <select className="premium-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="user">Usuario</option><option value="admin">Administrador</option></select>
      </div>
      <PermissionChecks permissions={form.permissions} onChange={(key, checked) => setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: checked } }))} />
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar invitación'}</button>
    </form>
    <div style={{ display: 'grid', gap: '1rem' }}>
      {users.map((user, index) => <div className="premium-card" key={user.id}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '.8rem', flexWrap: 'wrap' }}>
          <div>
            <strong>{user.display_name || user.email}</strong>
            <div style={{ color: '#64748b', fontSize: '.8rem' }}>{user.email}</div>
            <span style={{ display: 'inline-block', marginTop: '.35rem', padding: '.18rem .5rem', borderRadius: '999px', fontSize: '.7rem', fontWeight: 800, background: user.active ? '#dcfce7' : '#fee2e2', color: user.active ? '#166534' : '#991b1b' }}>
              {user.active ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <select className="premium-input" disabled={user.role === 'superadmin'} value={user.role} onChange={e => setUsers(prev => prev.map((item, i) => i === index ? { ...item, role: e.target.value } : item))}>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
              {user.role === 'superadmin' && <option value="superadmin">Superadministrador</option>}
            </select>
          </div>
        </div>
        <PermissionChecks disabled={user.role === 'superadmin'} permissions={user.role === 'superadmin' ? Object.fromEntries(MODULES.map(([key]) => [key, true])) : user.permissions} onChange={(key, checked) => setUsers(prev => prev.map((item, i) => i === index ? { ...item, permissions: { ...item.permissions, [key]: checked } } : item))} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', marginTop: '1rem' }}>
          <button className="btn btn-success" onClick={() => save(user)}>Guardar permisos</button>
          {user.role !== 'superadmin' && <>
            <button className="btn btn-secondary" disabled={Boolean(actionBusy)} onClick={() => runUserAction(user, 'resend-access')}>
              {actionBusy === `resend-access-${user.id}` ? 'Enviando…' : 'Reenviar acceso'}
            </button>
            <button className={user.active ? 'btn btn-danger' : 'btn btn-primary'} disabled={Boolean(actionBusy)} onClick={() => runUserAction(user, 'set-active')}>
              {actionBusy === `set-active-${user.id}` ? 'Procesando…' : user.active ? 'Desactivar' : 'Activar'}
            </button>
            <button className="btn btn-danger" disabled={Boolean(actionBusy)} onClick={() => runUserAction(user, 'delete-user')}>
              {actionBusy === `delete-user-${user.id}` ? 'Eliminando…' : 'Eliminar usuario'}
            </button>
          </>}
        </div>
      </div>)}
    </div>
  </div>;
}
