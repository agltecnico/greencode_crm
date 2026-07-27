/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import Swal from 'sweetalert2';

const AdminModeContext = createContext(null);
const ADMIN_PASSWORD_HASH = '050882dde08083177a10aeb37cd6e9b66e22faa97794fa7eb0efe9a9b600dab1';

const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const AdminModeProvider = ({ children }) => {
  const [isAdminMode, setIsAdminMode] = useState(() => sessionStorage.getItem('greencode_admin_mode') === '1');

  const unlockAdminMode = async () => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'Modo administrador',
      text: 'Introduce la contraseña para habilitar acciones de prueba y borrado.',
      input: 'password',
      inputAttributes: { autocomplete: 'current-password' },
      showCancelButton: true,
      confirmButtonText: 'Desbloquear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#7c3aed'
    });
    if (!isConfirmed) return false;
    if (await sha256(value || '') !== ADMIN_PASSWORD_HASH) {
      await Swal.fire('Acceso denegado', 'La contraseña no es correcta.', 'error');
      return false;
    }
    sessionStorage.setItem('greencode_admin_mode', '1');
    setIsAdminMode(true);
    await Swal.fire('Modo administrador activo', 'Las acciones avanzadas quedan habilitadas durante esta sesión.', 'success');
    return true;
  };

  const lockAdminMode = () => {
    sessionStorage.removeItem('greencode_admin_mode');
    setIsAdminMode(false);
  };

  const requireAdmin = async () => isAdminMode || unlockAdminMode();

  return (
    <AdminModeContext.Provider value={{ isAdminMode, unlockAdminMode, lockAdminMode, requireAdmin }}>
      {children}
    </AdminModeContext.Provider>
  );
};

export const useAdminMode = () => useContext(AdminModeContext);
