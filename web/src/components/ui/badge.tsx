import { cn } from '@/lib/utils';

// Lightweight status pill. Known statuses/priorities get color-coded; anything else
// falls back to a neutral chip (reused for roles too).
const STATUS_STYLES: Record<string, string> = {
  // NGO + campaign/disaster statuses
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
  // Coordination Board — need statuses
  open: 'bg-blue-100 text-blue-800',
  matched: 'bg-indigo-100 text-indigo-800',
  fulfilling: 'bg-amber-100 text-amber-800',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  closed: 'bg-muted text-muted-foreground',
  // Coordination Board — offer statuses
  available: 'bg-emerald-100 text-emerald-800',
  reserved: 'bg-amber-100 text-amber-800',
  committed: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-teal-100 text-teal-800',
  // Matching Loop — match statuses
  proposed: 'bg-sky-100 text-sky-800',
  accepted: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-red-100 text-red-800',
  // Inventory FSM — movement states
  stock_in: 'bg-emerald-100 text-emerald-800',
  allocated: 'bg-amber-100 text-amber-800',
  dispatched: 'bg-sky-100 text-sky-800',
  consumed: 'bg-slate-100 text-slate-700',
  correction: 'bg-purple-100 text-purple-800',
  // Beneficiaries — verification state
  verified: 'bg-emerald-100 text-emerald-800',
  unverified: 'bg-slate-100 text-slate-700',
  // Coordination Board — need priorities
  low: 'bg-slate-100 text-slate-700',
  moderate: 'bg-sky-100 text-sky-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const NEUTRAL = 'bg-muted text-muted-foreground';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLES[status] ?? NEUTRAL,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
