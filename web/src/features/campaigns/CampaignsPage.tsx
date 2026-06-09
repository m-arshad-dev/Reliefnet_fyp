import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import {
  createCampaign,
  listCampaigns,
  setCampaignStatus,
  CAMPAIGN_TRANSITIONS,
  type Campaign,
  type CampaignStatusTarget,
} from '@/lib/api/campaigns';
import { listDisasters } from '@/lib/api/disasters';
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

// NGO-admin screen: create campaigns nested under a global disaster + scoped to a
// region, list this NGO's campaigns, and move their status through the FSM. The server
// forces ngo_id from the JWT — there is no NGO picker by design.
export function CampaignsPage() {
  const qc = useQueryClient();
  const campaignsQuery = useQuery({ queryKey: ['campaigns'], queryFn: () => listCampaigns() });
  const disastersQuery = useQuery({ queryKey: ['disasters'], queryFn: () => listDisasters() });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: () => listLocations() });

  const disasters = disastersQuery.data?.items ?? [];
  const locations = locationsQuery.data ?? [];
  const locationOptions = buildLocationOptions(locations);
  const disasterName = (id: string) => disasters.find((d) => d.id === id)?.name ?? '—';
  const regionName = (id: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? '—') : '—';

  const [name, setName] = useState('');
  const [disasterId, setDisasterId] = useState('');
  const [targetRegionId, setTargetRegionId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (c) => {
      setFormOk(`Created "${c.name}".`);
      setName('');
      setDisasterId('');
      setTargetRegionId('');
      setStartsOn('');
      setEndsOn('');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatusTarget }) =>
      setCampaignStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    createMutation.mutate({
      name,
      disasterId,
      targetRegionId: targetRegionId || undefined,
      startsOn,
      endsOn: endsOn || undefined,
    });
  }

  const canTransition = (status: string, target: CampaignStatusTarget) =>
    (CAMPAIGN_TRANSITIONS[status] ?? []).includes(target);

  const columns: ColumnDef<Campaign, unknown>[] = [
    { accessorKey: 'name', header: 'Campaign' },
    { id: 'disaster', header: 'Disaster', cell: ({ row }) => disasterName(row.original.disasterId) },
    { id: 'region', header: 'Region', cell: ({ row }) => regionName(row.original.targetRegionId) },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    { accessorKey: 'startsOn', header: 'Starts' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const c = row.original;
        const action = (label: string, target: CampaignStatusTarget) => (
          <Button
            size="sm"
            variant="outline"
            disabled={!canTransition(c.status, target) || statusMutation.isPending}
            onClick={() => statusMutation.mutate({ id: c.id, status: target })}
          >
            {label}
          </Button>
        );
        return (
          <div className="flex gap-2">
            {action(c.status === 'paused' ? 'Resume' : 'Activate', 'active')}
            {action('Pause', 'paused')}
            {action('Complete', 'completed')}
          </div>
        );
      },
    },
  ];

  const noDisasters = !disastersQuery.isLoading && disasters.length === 0;

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Launch a campaign</CardTitle>
            <CardDescription>
              Nest a campaign under a disaster event and scope it to a region. It is
              created in your NGO with status <span className="font-medium">planning</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {noDisasters ? (
              <p className="text-sm text-muted-foreground">
                No disaster events exist yet. A system admin must declare one before you can
                launch a campaign.
              </p>
            ) : (
              <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disaster">Disaster</Label>
                  <select
                    id="disaster"
                    value={disasterId}
                    onChange={(e) => setDisasterId(e.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="" disabled>
                      Select a disaster…
                    </option>
                    {disasters.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Target region</Label>
                  <select
                    id="region"
                    value={targetRegionId}
                    onChange={(e) => setTargetRegionId(e.target.value)}
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
                    {createMutation.isPending ? 'Launching…' : 'Launch campaign'}
                  </Button>
                </div>
                {formError && <p className="text-sm text-destructive md:col-span-2">{formError}</p>}
                {formOk && <p className="text-sm text-emerald-600 md:col-span-2">{formOk}</p>}
              </form>
            )}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Campaigns</h2>
          {campaignsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : campaignsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load campaigns.</p>
          ) : (
            <DataTable
              columns={columns}
              data={campaignsQuery.data?.items ?? []}
              emptyMessage="No campaigns yet — launch one above."
            />
          )}
        </section>
      </main>
    </div>
  );
}
