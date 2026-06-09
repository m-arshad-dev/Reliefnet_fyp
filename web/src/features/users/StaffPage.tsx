import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import { createUser, listUsers, STAFF_ROLES, type StaffRole } from '@/lib/api/users';
import type { PublicUser } from '@/lib/api/auth';
import { AppHeader } from '@/components/AppHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function errorMessage(err: unknown): string {
  return err instanceof AxiosError
    ? (err.response?.data?.error?.message ?? 'Something went wrong')
    : 'Something went wrong';
}

// NGO-admin screen: list + create staff. The server scopes everything to the
// admin's own NGO (from the JWT) — there is no NGO picker by design.
export function StaffPage() {
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => listUsers() });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('volunteer');
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      setFormOk(`Created ${user.fullName} (${user.role}).`);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('volunteer');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    createMutation.mutate({ fullName, email, password, role });
  }

  const columns: ColumnDef<PublicUser, unknown>[] = [
    { accessorKey: 'fullName', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-8 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Add a staff member</CardTitle>
            <CardDescription>New users are created inside your NGO.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create user'}
                </Button>
              </div>
              {formError && (
                <p className="text-sm text-destructive md:col-span-2">{formError}</p>
              )}
              {formOk && <p className="text-sm text-emerald-600 md:col-span-2">{formOk}</p>}
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Staff</h2>
          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : usersQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load staff.</p>
          ) : (
            <DataTable
              columns={columns}
              data={usersQuery.data?.items ?? []}
              emptyMessage="No staff yet — add one above."
            />
          )}
        </section>
      </main>
    </div>
  );
}
