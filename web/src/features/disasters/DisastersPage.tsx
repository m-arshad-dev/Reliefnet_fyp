import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import {
  createDisaster,
  listDisasters,
  DISASTER_TYPES,
  DISASTER_SEVERITIES,
  type Disaster,
  type DisasterType,
  type DisasterSeverity,
} from '@/lib/api/disasters';
import { listLocations, buildLocationOptions } from '@/lib/api/locations';
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

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// System-admin screen: create global disaster events and list them. Disasters are the
// shared frame every NGO's campaigns nest under.
export function DisastersPage() {
  const qc = useQueryClient();
  const disastersQuery = useQuery({ queryKey: ['disasters'], queryFn: () => listDisasters() });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: () => listLocations() });

  const locations = locationsQuery.data ?? [];
  const locationOptions = buildLocationOptions(locations);
  const regionName = (id: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? '—') : '—';

  const [name, setName] = useState('');
  const [type, setType] = useState<DisasterType>('flood');
  const [severity, setSeverity] = useState<DisasterSeverity>('high');
  const [regionId, setRegionId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createDisaster,
    onSuccess: (d) => {
      setFormOk(`Created "${d.name}".`);
      setName('');
      setType('flood');
      setSeverity('high');
      setRegionId('');
      setStartsOn('');
      setEndsOn('');
      qc.invalidateQueries({ queryKey: ['disasters'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    createMutation.mutate({
      name,
      type,
      severity,
      regionId: regionId || undefined,
      startsOn,
      endsOn: endsOn || undefined,
    });
  }

  const columns: ColumnDef<Disaster, unknown>[] = [
    { accessorKey: 'name', header: 'Disaster' },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => <span className="capitalize">{String(getValue())}</span>,
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    { id: 'region', header: 'Region', cell: ({ row }) => regionName(row.original.regionId) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    { accessorKey: 'startsOn', header: 'Starts' },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Declare a disaster event</CardTitle>
            <CardDescription>
              Global events that NGOs scope their campaigns under (e.g. “Punjab Monsoon
              Floods 2026”).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region (optional)</Label>
                <select
                  id="region"
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— none —</option>
                  {locationOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as DisasterType)}
                  className={selectClass}
                >
                  {DISASTER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as DisasterSeverity)}
                  className={selectClass}
                >
                  {DISASTER_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsOn">Starts on</Label>
                <Input
                  id="startsOn"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsOn">Ends on (optional)</Label>
                <Input
                  id="endsOn"
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create disaster'}
                </Button>
              </div>
              {formError && <p className="text-sm text-destructive md:col-span-2">{formError}</p>}
              {formOk && <p className="text-sm text-emerald-600 md:col-span-2">{formOk}</p>}
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Disaster events</h2>
          {disastersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : disastersQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load disasters.</p>
          ) : (
            <DataTable
              columns={columns}
              data={disastersQuery.data?.items ?? []}
              emptyMessage="No disasters yet — declare one above."
            />
          )}
        </section>
      </main>
    </div>
  );
}
