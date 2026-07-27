import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ permission, children }) {
  const { user, profile, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading">Cargando acceso seguro…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile?.active) return <Navigate to="/login" replace />;
  const allowed = !permission || (Array.isArray(permission)
    ? permission.some(item => hasPermission(item))
    : hasPermission(permission));
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
