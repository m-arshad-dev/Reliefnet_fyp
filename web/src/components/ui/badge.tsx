import { cn } from '@/lib/utils';

// Lightweight status pill. NGO statuses get color-coded; anything else falls back
// to a neutral chip (reused for roles too).
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800',
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
