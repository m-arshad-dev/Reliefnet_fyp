import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import { listNgos, registerNgo, setNgoStatus, type Ngo } from '@/lib/api/ngos';
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

// System-admin screen: onboard NGOs (+ first admin) and vet/suspend them.
export function NgosPage() {
  const qc = useQueryClient();
  const ngosQuery = useQuery({ queryKey: ['ngos'], queryFn: () => listNgos() });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      setNgoStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ngos'] }),
  });

  const [name, setName] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: registerNgo,
    onSuccess: (res) => {
      setFormOk(`Onboarded "${res.ngo.name}" — admin login: ${res.admin.email}`);
      setName('');
      setRegistrationNo('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      qc.invalidateQueries({ queryKey: ['ngos'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  function onRegister(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    registerMutation.mutate({
      ngo: { name, registrationNo: registrationNo.trim() || undefined },
      admin: { fullName: adminName, email: adminEmail, password: adminPassword },
    });
  }

  const columns: ColumnDef<Ngo, unknown>[] = [
    { accessorKey: 'name', header: 'NGO' },
    {
      accessorKey: 'registrationNo',
      header: 'Reg. no',
      cell: ({ getValue }) => (getValue() as string | null) ?? '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => new Date(String(getValue())).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const ngo = row.original;
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={ngo.status === 'active' || statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: ngo.id, status: 'active' })}
            >
              Vet
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={ngo.status === 'suspended' || statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: ngo.id, status: 'suspended' })}
            >
              Suspend
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Onboard an NGO</CardTitle>
            <CardDescription>
              Creates the NGO (status <span className="font-medium">pending</span>) and its
              first NGO admin. Vet it below to activate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onRegister} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">NGO name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationNo">Registration no. (optional)</Label>
                <Input
                  id="registrationNo"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin full name</Label>
                <Input
                  id="adminName"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? 'Onboarding…' : 'Onboard NGO'}
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
          <h2 className="text-lg font-semibold">NGOs</h2>
          {ngosQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : ngosQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load NGOs.</p>
          ) : (
            <DataTable
              columns={columns}
              data={ngosQuery.data?.items ?? []}
              emptyMessage="No NGOs yet — onboard one above."
            />
          )}
        </section>
      </main>
    </div>
  );
}
