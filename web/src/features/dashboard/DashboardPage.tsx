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

// Role-aware home. The header carries the nav; here we surface action cards for the
// roles that have a screen so far.
interface QuickLink {
  to: string;
  title: string;
  description: string;
}

const QUICK_LINKS: Record<string, QuickLink[]> = {
  system_admin: [
    { to: '/ngos', title: 'NGOs', description: 'Onboard and vet NGOs, then activate or suspend them.' },
    {
      to: '/disasters',
      title: 'Disasters',
      description: 'Declare global disaster events that NGOs run campaigns under.',
    },
  ],
  ngo_admin: [
    {
      to: '/staff',
      title: 'Staff',
      description: 'Add field coordinators, volunteers, and data-entry users to your NGO.',
    },
    {
      to: '/campaigns',
      title: 'Campaigns',
      description: 'Launch campaigns under a disaster, scoped to a region, and move their status.',
    },
  ],
};

export function DashboardPage() {
  const { user } = useAuth();
  const quickLinks = user ? (QUICK_LINKS[user.role] ?? []) : [];

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

        {quickLinks.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="block">
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">Open {link.title} →</CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No admin tools for your role yet — field workflows arrive in later slices.
          </p>
        )}
      </main>
    </div>
  );
}
