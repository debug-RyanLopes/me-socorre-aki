import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homePathFor } from '../lib/labels';
import type { Role } from '../lib/types';
import { useAuth } from './AuthProvider';

export function RequireRole({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p role="status" className="muted" style={{ padding: 32 }}>Carregando…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
