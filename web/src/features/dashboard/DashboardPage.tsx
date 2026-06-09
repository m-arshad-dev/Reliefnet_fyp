import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Role-aware home. The header carries the nav; here we surface a primary action
// card for the roles that have a Slice 1 screen.
const QUICK_LINKS: Record<string, { to: string; title: string; description: string }> = {
  system_admin: {
    to: '/ngos',
    title: 'NGOs',
    description: 'Onboard and vet NGOs, then activate or suspend them.',
  },
  ngo_admin: {
    to: '/staff',
    title: 'Staff',
    description: 'Add field coordinators, volunteers, and data-entry users to your NGO.',
  },
};

export function DashboardPage() {
  const { user } = useAuth();
  const quickLink = user ? QUICK_LINKS[user.role] : undefined;

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {user?.fullName} · {user?.role}.
          </p>
        </div>

        {quickLink ? (
          <Link to={quickLink.to} className="block max-w-md">
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle className="text-lg">{quickLink.title}</CardTitle>
                <CardDescription>{quickLink.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-primary">Open {quickLink.title} →</CardContent>
            </Card>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            No admin tools for your role yet — field workflows arrive in later slices.
          </p>
        )}
      </main>
    </div>
  );
}
