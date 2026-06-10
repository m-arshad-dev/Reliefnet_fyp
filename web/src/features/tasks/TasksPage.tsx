import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import {
  listTasks,
  createTask,
  transitionTask,
  listHistory,
  TASK_TRANSITIONS,
  canTransition,
  isAssignEdge,
  actionLabel,
  type Task,
  type TaskTransition,
} from '@/lib/api/tasks';
import { listCampaigns } from '@/lib/api/campaigns';
import { listUsers } from '@/lib/api/users';
import type { PublicUser } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthContext';
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
const inlineSelectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const MANAGE_ROLES = ['ngo_admin', 'field_coordinator'];

function assigneeLabel(task: Task, staffById: Map<string, PublicUser>): string {
  if (!task.assignedTo) return '—';
  return staffById.get(task.assignedTo)?.fullName ?? 'Assigned';
}

// Create/assign form — coordinator/admin only. campaignId comes from the tenant's campaigns;
// the optional assignee select only appears for ngo_admin (GET /users is user:manage). A
// field_coordinator creates an unassigned task; an ngo_admin assigns it later on the board.
function CreateTaskForm({
  campaigns,
  staff,
  canAssign,
}: {
  campaigns: { id: string; name: string }[];
  staff: PublicUser[];
  canAssign: boolean;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      setOk(`Created "${task.title}".`);
      setTitle('');
      setDescription('');
      setAssignedTo('');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!campaignId) {
      setErr('Select a campaign first.');
      return;
    }
    mutation.mutate({
      title,
      description: description.trim() || undefined,
      campaignId,
      assignedTo: assignedTo || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a task</CardTitle>
        <CardDescription>
          A task starts in <span className="font-medium">created</span>, then moves through the
          lifecycle. {canAssign ? 'Optionally assign a volunteer now.' : 'Assignment happens on the board.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="taskTitle">Title</Label>
            <Input
              id="taskTitle"
              placeholder="Distribute 50 ration packs at Village X"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="taskDesc">Description</Label>
            <Input
              id="taskDesc"
              placeholder="Optional details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskCampaign">Campaign</Label>
            <select
              id="taskCampaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">Select a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {canAssign && (
            <div className="space-y-2">
              <Label htmlFor="taskAssignee">Assignee (optional)</Label>
              <select
                id="taskAssignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={selectClass}
              >
                <option value="">Unassigned</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end md:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create task'}
            </Button>
          </div>
          {err && <p className="text-sm text-destructive md:col-span-2">{err}</p>}
          {ok && <p className="text-sm text-emerald-600 md:col-span-2">{ok}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

// The legal next-state buttons for one task that the current role may perform. Mirrors the
// server FSM + per-edge auth; the server re-validates and is the source of truth. Assign edges
// pair an assignee <select> with the button; rejecting prompts for an optional note. When a
// rejection is capped, the server returns status 'escalated' and we surface that.
function TaskActions({
  task,
  role,
  staff,
}: {
  task: Task;
  role: string;
  staff: PublicUser[];
}) {
  const qc = useQueryClient();
  const [assignee, setAssignee] = useState(task.assignedTo ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof transitionTask>[1]) => transitionTask(task.id, input),
    onSuccess: (updated, input) => {
      if (input.toStatus === 'rejected' && updated.status === 'escalated') {
        setNotice('Rejection cap reached — escalated for coordinator review.');
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const targets = (TASK_TRANSITIONS[task.status] ?? []).filter((to) =>
    canTransition(role, task.status, to),
  );

  if (targets.length === 0) {
    return <span className="text-xs text-muted-foreground">{notice ?? '—'}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {targets.map((to) => {
          if (isAssignEdge(to)) {
            const canPick = staff.length > 0;
            const blocked = canPick && !assignee && !task.assignedTo;
            return (
              <span key={to} className="flex items-center gap-1">
                {canPick && (
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className={inlineSelectClass}
                    aria-label="Assignee"
                  >
                    <option value="">Assignee…</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending || blocked}
                  onClick={() => {
                    setErr(null);
                    setNotice(null);
                    mutation.mutate({ toStatus: 'assigned', assignedTo: assignee || undefined });
                  }}
                >
                  {actionLabel(task.status, to)}
                </Button>
              </span>
            );
          }
          const isReject = to === 'rejected';
          return (
            <Button
              key={to}
              size="sm"
              variant={isReject ? 'outline' : 'default'}
              disabled={mutation.isPending}
              onClick={() => {
                setErr(null);
                setNotice(null);
                let note: string | undefined;
                if (isReject) {
                  const entered = window.prompt('Optional rejection note (Cancel aborts):');
                  if (entered === null) return; // cancelled
                  note = entered.trim() || undefined;
                }
                mutation.mutate({ toStatus: to, note });
              }}
            >
              {actionLabel(task.status, to)}
            </Button>
          );
        })}
      </div>
      {notice && <span className="text-xs text-orange-700">{notice}</span>}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}

// Append-only transition history for one task (GET /tasks/:id/history).
function TaskHistory({ task }: { task: Task }) {
  const query = useQuery({
    queryKey: ['tasks', 'history', task.id],
    queryFn: () => listHistory(task.id),
  });

  const columns: ColumnDef<TaskTransition, unknown>[] = [
    {
      accessorKey: 'createdAt',
      header: 'When',
      cell: ({ getValue }) => new Date(String(getValue())).toLocaleString(),
    },
    {
      id: 'flow',
      header: 'Flow',
      cell: ({ row }) => {
        const t = row.original;
        return (
          <span className="flex items-center gap-1 text-xs">
            {t.fromStatus ? (
              <>
                <span className="text-muted-foreground">{t.fromStatus.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">→</span>
              </>
            ) : (
              <span className="text-muted-foreground">created →</span>
            )}
            <StatusBadge status={t.toStatus} />
          </span>
        );
      },
    },
    {
      accessorKey: 'note',
      header: 'Note',
      cell: ({ getValue }) => (getValue() as string | null) ?? '—',
    },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">
        History — {task.title}{' '}
        <span className="text-sm font-normal text-muted-foreground">
          ({task.status.replace(/_/g, ' ')} · {task.rejectionCount} rejection
          {task.rejectionCount === 1 ? '' : 's'})
        </span>
      </h3>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Failed to load history.</p>
      ) : (
        <DataTable columns={columns} data={query.data?.items ?? []} emptyMessage="No history." />
      )}
    </section>
  );
}

function buildColumns(
  role: string,
  staff: PublicUser[],
  staffById: Map<string, PublicUser>,
  selectedId: string | null,
  setSelectedId: (fn: (cur: string | null) => string | null) => void,
): ColumnDef<Task, unknown>[] {
  return [
    { accessorKey: 'title', header: 'Task' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    {
      id: 'assignee',
      header: 'Assignee',
      cell: ({ row }) => assigneeLabel(row.original, staffById),
    },
    {
      accessorKey: 'rejectionCount',
      header: 'Rejections',
      cell: ({ getValue }) => {
        const n = getValue() as number;
        return <span className={n > 0 ? 'font-semibold text-orange-700' : ''}>{n}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => <TaskActions task={row.original} role={role} staff={staff} />,
    },
    {
      id: 'history',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedId((cur) => (cur === row.original.id ? null : row.original.id))}
        >
          {selectedId === row.original.id ? 'Hide' : 'History'}
        </Button>
      ),
    },
  ];
}

// Slice 7 — a THIN task-FSM screen. Coordinators/admins create + assign + verify; volunteers
// execute (start / submit). The rejection count is visible, and a third rejection escalates —
// surfaced in the escalated queue below for coordinator/admin review.
export function TasksPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isManager = MANAGE_ROLES.includes(role);
  const canListStaff = role === 'ngo_admin';

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tasksQuery = useQuery({ queryKey: ['tasks', 'all'], queryFn: () => listTasks() });
  const escalatedQuery = useQuery({
    queryKey: ['tasks', 'escalated'],
    queryFn: () => listTasks({ status: 'escalated' }),
    enabled: isManager,
  });
  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => listCampaigns(),
    enabled: isManager,
  });
  const staffQuery = useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => listUsers(),
    enabled: canListStaff,
  });

  const tasks = tasksQuery.data?.items ?? [];
  const escalated = escalatedQuery.data?.items ?? [];
  const staff = staffQuery.data?.items ?? [];
  const staffById = new Map(staff.map((u) => [u.id, u]));
  const campaigns = campaignsQuery.data?.items ?? [];
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const columns = buildColumns(role, staff, staffById, selectedId, setSelectedId);
  const escalatedColumns: ColumnDef<Task, unknown>[] = [
    { accessorKey: 'title', header: 'Task' },
    {
      id: 'assignee',
      header: 'Last assignee',
      cell: ({ row }) => assigneeLabel(row.original, staffById),
    },
    {
      accessorKey: 'rejectionCount',
      header: 'Rejections',
      cell: ({ getValue }) => (
        <span className="font-semibold text-orange-700">{getValue() as number}</span>
      ),
    },
    {
      id: 'reset',
      header: 'Action',
      cell: ({ row }) => <TaskActions task={row.original} role={role} staff={staff} />,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-8">
        {isManager && (
          <CreateTaskForm campaigns={campaigns} staff={staff} canAssign={canListStaff} />
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tasks</h2>
          {tasksQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tasksQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load tasks.</p>
          ) : (
            <DataTable
              columns={columns}
              data={tasks}
              emptyMessage={isManager ? 'No tasks yet — create one above.' : 'No tasks assigned yet.'}
            />
          )}
        </section>

        {selected && <TaskHistory task={selected} />}

        {isManager && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-orange-800">
              Escalated queue{' '}
              <span className="text-sm font-normal text-muted-foreground">
                — stuck tasks (3+ rejections) awaiting a coordinator
              </span>
            </h2>
            {escalatedQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <DataTable
                columns={escalatedColumns}
                data={escalated}
                emptyMessage="Nothing escalated — all tasks are on track."
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
