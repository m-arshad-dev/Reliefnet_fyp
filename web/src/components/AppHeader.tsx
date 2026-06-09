import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Single source of truth for top-nav. Links are role-gated here too (not just by
// the route guards), so a volunteer literally has no NGOs/Staff link to click.
const NAV: { to: string; label: string; roles: string[] }[] = [
  { to: '/dashboard', label: 'Dashboard', roles: ['*'] },
  { to: '/ngos', label: 'NGOs', roles: ['system_admin'] },
  { to: '/disasters', label: 'Disasters', roles: ['system_admin'] },
  { to: '/staff', label: 'Staff', roles: ['ngo_admin'] },
  { to: '/campaigns', label: 'Campaigns', roles: ['ngo_admin'] },
];

export function AppHeader() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const links = NAV.filter(
    (item) => user && (item.roles.includes('*') || item.roles.includes(user.role)),
  );

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-6">
        <div className="font-semibold">RELIEFNET</div>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'text-muted-foreground transition-colors hover:text-foreground',
                pathname === item.to && 'font-medium text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {user?.fullName} · {user?.role}
        </span>
        <Button variant="outline" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
