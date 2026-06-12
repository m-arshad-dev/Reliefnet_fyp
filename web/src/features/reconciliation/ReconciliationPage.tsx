import { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import {
  listConflicts,
  resolveConflict,
  type Resolution,
  type SyncConflict,
} from '@/lib/api/sync';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
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

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// One side of the diff — a labelled, scrollable JSON panel.
function DiffPanel({ title, tone, value }: { title: string; tone: 'client' | 'server'; value: unknown }) {
  return (
    <div className="space-y-1">
      <div
        className={
          tone === 'client'
            ? 'text-xs font-semibold uppercase tracking-wide text-amber-700'
            : 'text-xs font-semibold uppercase tracking-wide text-sky-700'
        }
      >
        {title}
      </div>
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {pretty(value)}
      </pre>
    </div>
  );
}

// A single conflict, with the side-by-side diff and the three resolution actions. keep_server /
// keep_client are one-click; merge reveals an editable JSON editor seeded from the server snapshot
// so a coordinator can hand-pick the reconciled state (for a task, set its `status`).
function ConflictCard({ conflict, onResolved }: { conflict: SyncConflict; onResolved: (id: string) => void }) {
  const [showMerge, setShowMerge] = useState(false);
  const [mergeText, setMergeText] = useState(() => pretty(conflict.serverSnapshot ?? {}));
  const [pending, setPending] = useState<Resolution | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(resolution: Resolution) {
    setErr(null);
    let mergedPayload: unknown;
    if (resolution === 'merge') {
      try {
        mergedPayload = JSON.parse(mergeText);
      } catch {
        setErr('Merge payload must be valid JSON.');
        return;
      }
    }
    setPending(resolution);
    try {
      await resolveConflict(conflict.conflictId, { resolution, mergedPayload });
      onResolved(conflict.conflictId);
    } catch (e) {
      setErr(errorMessage(e));
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="font-mono">{conflict.entityType}</span>
          {conflict.entityId && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">{conflict.entityId}</span>
          )}
        </CardTitle>
        <CardDescription>
          Captured on the device {new Date(conflict.clientCreatedAt).toLocaleString()} · arrived{' '}
          {new Date(conflict.receivedAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DiffPanel title="Client (mobile)" tone="client" value={conflict.clientPayload} />
          <DiffPanel title="Server (current)" tone="server" value={conflict.serverSnapshot} />
        </div>

        {showMerge && (
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Merged result (JSON) — e.g. set <code className="font-mono">"status"</code>
            </div>
            <textarea
              className="h-40 w-full rounded-md border bg-background p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={mergeText}
              onChange={(e) => setMergeText(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={pending !== null} onClick={() => void resolve('keep_server')}>
            {pending === 'keep_server' ? 'Resolving…' : 'Keep server'}
          </Button>
          <Button variant="outline" disabled={pending !== null} onClick={() => void resolve('keep_client')}>
            {pending === 'keep_client' ? 'Resolving…' : 'Keep client'}
          </Button>
          {showMerge ? (
            <Button disabled={pending !== null} onClick={() => void resolve('merge')}>
              {pending === 'merge' ? 'Resolving…' : 'Apply merge'}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setShowMerge(true)}>
              Merge…
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Slice 12 — the web reconciliation screen. Role-gated to coordinator/admin. Lists open sync
// conflicts (keyset-paginated) with a side-by-side diff and resolve actions. The side-by-side diff
// genuinely needs screen real estate, which is why reconciliation lives on web, not mobile (v2
// §6.1) — the device only shows an "N conflicts" badge.
export function ReconciliationPage() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setErr(null);
      try {
        const page = await listConflicts({ cursor: reset ? undefined : nextCursor || undefined, limit: 25 });
        setConflicts((cur) => (reset ? page.items : [...cur, ...page.items]));
        setNextCursor(page.nextCursor);
      } catch (e) {
        setErr(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [nextCursor],
  );

  useEffect(() => {
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResolved = useCallback((id: string) => {
    setConflicts((cur) => cur.filter((c) => c.conflictId !== id));
  }, []);

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sync reconciliation</CardTitle>
            <CardDescription>
              Offline field writes whose base diverged from the server. Resolve each by keeping the
              server record, keeping the device's version, or merging — the device reconciles on its
              next sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => void fetchPage(true)} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
              <span className="text-xs text-muted-foreground">{conflicts.length} pending</span>
            </div>
          </CardContent>
        </Card>

        {err && <p className="text-sm text-destructive">{err}</p>}

        {conflicts.length === 0 && !loading && !err && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No conflicts pending. All offline writes have merged cleanly.
            </CardContent>
          </Card>
        )}

        {conflicts.map((c) => (
          <ConflictCard key={c.conflictId} conflict={c} onResolved={onResolved} />
        ))}

        {nextCursor && (
          <Button variant="outline" onClick={() => void fetchPage(false)} disabled={loading}>
            Load more
          </Button>
        )}
      </main>
    </div>
  );
}
