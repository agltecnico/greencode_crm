import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAdminMode } from '../context/AdminModeContext';

export default function AdminModeButton() {
  const { isAdminMode, unlockAdminMode, lockAdminMode } = useAdminMode();
  return (
    <button
      type="button"
      className={`btn ${isAdminMode ? 'btn-danger' : 'btn-secondary'}`}
      onClick={isAdminMode ? lockAdminMode : unlockAdminMode}
      title={isAdminMode ? 'Cerrar el modo administrador' : 'Abrir el modo administrador'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.8rem' }}
    >
      {isAdminMode ? <ShieldCheck size={17} /> : <LockKeyhole size={17} />}
      {isAdminMode ? 'Admin activo' : 'Modo admin'}
    </button>
  );
}
