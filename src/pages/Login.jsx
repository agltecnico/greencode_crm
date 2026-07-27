import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading, signIn, signUpFirstAdmin, resetPassword, firstAdminEmail } = useAuth();
  const [email, setEmail] = useState(firstAdminEmail);
  const [password, setPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!loading && user) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    const { error } = creatingAdmin
      ? await signUpFirstAdmin(password)
      : await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (error) {
      Swal.fire('No se pudo acceder', error.message, 'error');
      return;
    }
    if (creatingAdmin) {
      Swal.fire('Cuenta creada', 'Revisa el correo si Supabase solicita confirmar la dirección.', 'success');
    }
    navigate(location.state?.from || '/', { replace: true });
  };

  const recover = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return;
    const { error } = await resetPassword(target);
    Swal.fire(error ? 'No se pudo enviar' : 'Correo enviado', error?.message || 'Revisa tu bandeja para establecer una nueva contraseña.', error ? 'error' : 'success');
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="GreenCode" className="login-logo" />
        <h1>Acceso GreenCode</h1>
        <p>{creatingAdmin ? 'Activa el primer superadministrador' : 'Identifícate para entrar al CRM'}</p>
        <label>Correo electrónico</label>
        <input className="premium-input" type="email" required value={creatingAdmin ? firstAdminEmail : email} disabled={creatingAdmin} onChange={e => setEmail(e.target.value)} />
        <label>Contraseña</label>
        <input className="premium-input" type="password" required minLength="8" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Comprobando…' : creatingAdmin ? 'Crear superadministrador' : 'Entrar'}</button>
        {!creatingAdmin && <button type="button" className="login-link" onClick={recover}>He olvidado la contraseña</button>}
        <button type="button" className="login-link" onClick={() => setCreatingAdmin(value => !value)}>
          {creatingAdmin ? 'Volver al acceso' : 'Activar primera cuenta administrativa'}
        </button>
      </form>
    </div>
  );
}
