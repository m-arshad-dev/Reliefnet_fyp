import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import {
  listLedger,
  verifyChain,
  AUDIT_ENTITY_TYPES,
  type AuditEntry,
  type VerifyResult,
} from '@/lib/api/audit';
import { AppHeader } from '@/components/AppHeader';
import { DataTable } from '@/components/DataTable';
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

// A short, hover-expandable hash chip (the full 64-char hash is in the title).
function Hash({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <code className="font-mono text-xs text-muted-foreground" title={value}>
      {value.slice(0, 12)}…
    </code>
  );
}

const columns: ColumnDef<AuditEntry, unknown>[] = [
  { accessorKey: 'id', header: '#', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
  {
    accessorKey: 'createdAt',
    header: 'Time',
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-xs">{new Date(getValue() as string).toLocaleString()}</span>
    ),
  },
  { accessorKey: 'action', header: 'Action', cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
  { accessorKey: 'entityType', header: 'Entity' },
  {
    accessorKey: 'entityId',
    header: 'Entity ID',
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return <span className="font-mono text-xs">{v ? `${v.slice(0, 8)}…` : '—'}</span>;
    },
  },
  {
    accessorKey: 'metadata',
    header: 'Metadata',
    cell: ({ getValue }) => (
      <code className="font-mono text-xs text-muted-foreground">{JSON.stringify(getValue())}</code>
    ),
  },
  { accessorKey: 'rowHash', header: 'Row hash', cell: ({ getValue }) => <Hash value={getValue() as string} /> },
];

// The chain-integrity banner. Intact = green; broken = red with the first bad row + reason.
function VerifyPanel() {
  const mutation = useMutation<VerifyResult>({ mutationFn: () => verifyChain() });
  const result = mutation.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Chain integrity</CardTitle>
        <CardDescription>
          Recomputes the whole hash chain. Any edited or deleted ledger row breaks it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Verifying…' : 'Verify chain integrity'}
        </Button>

        {mutation.isError && (
          <p className="text-sm text-destructive">{errorMessage(mutation.error)}</p>
        )}

        {result?.ok && (
          <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700">
            ✓ Chain intact — {result.checked} {result.checked === 1 ? 'entry' : 'entries'} verified.
          </div>
        )}

        {result && !result.ok && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            ✗ Chain BROKEN at row #{result.brokenRow?.id} ({result.brokenRow?.reason}). {result.checked}{' '}
            entries scanned. The ledger has been tampered with.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Slice 10 — a THIN auditor screen: a verify button + a filterable, keyset-paginated ledger
// viewer. Role-gated to auditor + system_admin (oversight roles see the whole global chain).
export function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [actorId, setActorId] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setErr(null);
      try {
        const page = await listLedger({
          entityType: entityType || undefined,
          actorId: actorFilter || undefined,
          cursor: reset ? undefined : nextCursor || undefined,
          limit: 50,
        });
        setEntries((cur) => (reset ? page.items : [...cur, ...page.items]));
        setNextCursor(page.nextCursor);
      } catch (e) {
        setErr(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [entityType, actorFilter, nextCursor],
  );

  // Reload from the top whenever an applied filter changes (entityType, or a submitted actorId).
  useEffect(() => {
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, actorFilter]);

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-8 p-8">
        <VerifyPanel />

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Audit ledger</CardTitle>
            <CardDescription>
              Append-only, hash-chained record of every state change across all NGOs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="entityType">Entity type</Label>
                <select
                  id="entityType"
                  className={selectClass}
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                >
                  <option value="">All</option>
                  {AUDIT_ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="actorId">Actor ID</Label>
                <Input
                  id="actorId"
                  className="w-80"
                  placeholder="user uuid…"
                  value={actorId}
                  onChange={(e) => setActorId(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => setActorFilter(actorId.trim())}>
                Apply
              </Button>
            </div>

            {err && <p className="text-sm text-destructive">{err}</p>}

            <DataTable
              columns={columns}
              data={entries}
              emptyMessage={loading ? 'Loading…' : 'No ledger entries match.'}
            />

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => void fetchPage(false)}
                disabled={loading || !nextCursor}
              >
                {nextCursor ? 'Load more' : 'End of ledger'}
              </Button>
              <span className="text-xs text-muted-foreground">{entries.length} loaded</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
