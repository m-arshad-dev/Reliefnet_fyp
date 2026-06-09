import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Route guard: blocks rendering until auth state is known, then either shows the
// protected route (Outlet) or redirects to /login.
export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
