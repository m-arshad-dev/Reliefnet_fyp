import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Role-gated route guard. Nest under <RequireAuth> so auth/loading is already
// settled; this only checks the role claim and bounces unauthorized users back to
// the dashboard (a volunteer who types /ngos never sees the NGOs table).
export function RequireRole({ allow }: { allow: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
