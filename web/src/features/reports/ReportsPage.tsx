import { useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { listDisasters } from '@/lib/api/disasters';
import {
  getHeatmap,
  getCoverageGaps,
  getUnmatchedNeeds,
  getResourceAvailability,
  get3WMatrix,
  type CoverageLocation,
  type HeatmapResult,
  type CoverageGapsResult,
  type UnmatchedNeedsResult,
  type AvailabilityResult,
  type ThreeWResult,
  type ThreeWCell,
} from '@/lib/api/reports';
import { AppHeader } from '@/components/AppHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (r: number | null) => (r == null ? 'no data' : `${(r * 100).toFixed(1)}%`);
const num = (n: number | null) => (n == null ? '—' : n.toLocaleString());

// A location counts as a gap below 25% coverage; the bar is red below that line.
const GAP_LINE = 0.25;
const barColor = (ratio: number | null) =>
  ratio == null || ratio < GAP_LINE ? '#ef4444' : '#10b981';

// Card wrapper so each panel renders its own loading / empty / error state uniformly.
function Panel({
  title,
  description,
  query,
  isEmpty,
  emptyText,
  children,
}: {
  title: string;
  description?: string;
  query: UseQueryResult<unknown>;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : query.isError ? (
          <p className="text-sm text-destructive">Failed to load.</p>
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

const gapColumns: ColumnDef<CoverageLocation, unknown>[] = [
  {
    header: 'Location',
    accessorKey: 'name',
    cell: ({ row }) => (
      <span>
        {row.original.name}{' '}
        <span className="text-xs text-muted-foreground">({row.original.level})</span>
      </span>
    ),
  },
  { header: 'Census', cell: ({ row }) => num(row.original.censusPopulation) },
  { header: 'People reached', cell: ({ row }) => num(row.original.peopleReached) },
  { header: 'Coverage', cell: ({ row }) => pct(row.original.coverageRatio) },
  { header: 'Open needs', cell: ({ row }) => row.original.openNeeds },
];

const threeWColumns: ColumnDef<ThreeWCell, unknown>[] = [
  { header: 'NGO (Who)', accessorKey: 'ngoName' },
  { header: 'Location (Where)', cell: ({ row }) => row.original.locationName ?? '—' },
  { header: 'Campaigns', cell: ({ row }) => row.original.campaigns },
  { header: 'Open needs', cell: ({ row }) => row.original.openNeeds },
  { header: 'Shared offers', cell: ({ row }) => row.original.sharedOffers },
  { header: 'Matches', cell: ({ row }) => row.original.matches },
];

// Slice 8 Coordination Dashboard / 3W — the read-only command picture. A disaster
// selector drives five CROSS-TENANT aggregate panels: a coverage heatmap (Recharts),
// a coverage-gap list, an unmatched-needs summary, a privacy-preserving resource
// availability summary (NGO counts only — never quantities), and the 3W matrix.
export function ReportsPage() {
  const [disasterId, setDisasterId] = useState('');

  const disastersQuery = useQuery({ queryKey: ['disasters'], queryFn: () => listDisasters() });
  const disasters = disastersQuery.data?.items ?? [];

  // Auto-select the first disaster so the dashboard shows data on first load.
  useEffect(() => {
    if (disasterId === '' && disasters.length > 0) setDisasterId(disasters[0].id);
  }, [disasters, disasterId]);

  const enabled = disasterId !== '';
  const heatmapQuery = useQuery<HeatmapResult>({
    queryKey: ['report-heatmap', disasterId],
    queryFn: () => getHeatmap(disasterId),
    enabled,
  });
  const gapsQuery = useQuery<CoverageGapsResult>({
    queryKey: ['report-gaps', disasterId],
    queryFn: () => getCoverageGaps(disasterId),
    enabled,
  });
  const unmatchedQuery = useQuery<UnmatchedNeedsResult>({
    queryKey: ['report-unmatched', disasterId],
    queryFn: () => getUnmatchedNeeds(disasterId),
    enabled,
  });
  const availabilityQuery = useQuery<AvailabilityResult>({
    queryKey: ['report-availability', disasterId],
    queryFn: () => getResourceAvailability(disasterId),
    enabled,
  });
  const threeWQuery = useQuery<ThreeWResult>({
    queryKey: ['report-3w', disasterId],
    queryFn: () => get3WMatrix(disasterId),
    enabled,
  });

  // Chart only locations with activity (aid or demand) so real million-population
  // districts with no coverage don't flatten the bars to an unreadable wall of zeros.
  const chartData = (heatmapQuery.data?.locations ?? [])
    .filter((l) => l.peopleReached > 0 || l.openNeeds > 0)
    .map((l) => ({
      name: l.name,
      coveragePct: l.coverageRatio == null ? 0 : Math.round(l.coverageRatio * 1000) / 10,
      ratio: l.coverageRatio,
    }));

  const gaps = gapsQuery.data?.locations ?? [];
  const unmatched = unmatchedQuery.data;
  const availability = availabilityQuery.data?.summary ?? [];
  const cells = threeWQuery.data?.cells ?? [];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-6 p-8">
        <div>
          <h1 className="text-xl font-semibold">Coordination Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who is doing what, where — coverage, gaps, and unmatched needs aggregated across
            every NGO in a disaster.
          </p>
        </div>

        <div className="max-w-md">
          <Label htmlFor="disaster">Disaster</Label>
          <select
            id="disaster"
            className={selectClass}
            value={disasterId}
            onChange={(e) => setDisasterId(e.target.value)}
          >
            <option value="">Select a disaster…</option>
            {disasters.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            Select a disaster to see the command picture.
          </p>
        ) : (
          <div className="space-y-6">
            {/* 1. Coverage heatmap */}
            <Panel
              title="Coverage heatmap"
              description="Aid delivered vs census population per location. Red bars fall below the 25% coverage line."
              query={heatmapQuery}
              isEmpty={chartData.length === 0}
              emptyText="No aid or open needs recorded at any location yet."
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 64, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    height={70}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Coverage']} />
                  <Bar dataKey="coveragePct" name="Coverage %">
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={barColor(d.ratio)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* 2. Coverage-gap list */}
            <Panel
              title="Coverage gaps"
              description={`Underserved locations (coverage below ${Math.round(
                (gapsQuery.data?.threshold ?? GAP_LINE) * 100,
              )}%), worst first.`}
              query={gapsQuery}
              isEmpty={gaps.length === 0}
              emptyText="No underserved locations — every location is above the coverage line."
            >
              <DataTable columns={gapColumns} data={gaps} emptyMessage="No gaps." />
            </Panel>

            <div className="grid gap-6 md:grid-cols-2">
              {/* 3. Unmatched needs */}
              <Panel
                title="Unmatched needs"
                description="Open needs with no live match, by type and priority."
                query={unmatchedQuery}
                isEmpty={!unmatched || unmatched.byTypePriority.length === 0}
                emptyText="No unmatched open needs — every need has a live match."
              >
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {unmatched?.totals.needCount ?? 0}
                    </span>{' '}
                    needs ·{' '}
                    <span className="font-semibold text-foreground">
                      {num(unmatched?.totals.totalQuantity ?? 0)}
                    </span>{' '}
                    units unmet
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(unmatched?.byTypePriority ?? []).map((g) => (
                      <div
                        key={`${g.type}-${g.priority}`}
                        className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{capitalize(g.type)}</span>
                          <StatusBadge status={g.priority} />
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold">{num(g.totalQuantity)}</div>
                          <div className="text-xs text-muted-foreground">{g.needCount} needs</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              {/* 4. Resource availability (privacy-preserving: NGO counts only) */}
              <Panel
                title="Resource availability"
                description="How many NGOs have shared surplus per type and region. Counts only — never quantities."
                query={availabilityQuery}
                isEmpty={availability.length === 0}
                emptyText="No shared surplus offered in this disaster yet."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {availability.map((a) => (
                    <div
                      key={`${a.type}-${a.locationId ?? 'none'}`}
                      className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
                    >
                      <div className="text-2xl font-semibold tabular-nums">{a.ngoCount}</div>
                      <div className="text-sm">
                        <div className="font-medium">{capitalize(a.type)}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.ngoCount === 1 ? 'NGO' : 'NGOs'} · {a.locationName ?? 'Unspecified'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* 5. 3W matrix */}
            <Panel
              title="3W matrix — Who · What · Where"
              description="Each NGO's activity per location: campaigns, open needs, shared offers, and matches."
              query={threeWQuery}
              isEmpty={cells.length === 0}
              emptyText="No NGO activity recorded in this disaster yet."
            >
              <DataTable columns={threeWColumns} data={cells} emptyMessage="No activity." />
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}
