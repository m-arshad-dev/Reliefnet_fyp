import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/button';

// Slice 0: an intentionally empty authenticated shell. Real coordination
// features (NGOs, disasters, the coordination board) arrive in later slices.
export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="font-semibold">RELIEFNET</div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {user?.fullName} · {user?.role}
          </span>
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&rsquo;re signed in. This empty shell is Slice 0 — coordination features land in
          later slices.
        </p>
      </main>
    </div>
  );
}
