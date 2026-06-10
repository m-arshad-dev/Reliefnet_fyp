// Slice 6 Inventory FSM — the single backend source of truth for the inventory enums.
// inventory.routes.ts builds its Zod `z.enum(...)` from these tuples; the service draws on
// them too. The forward TRANSITIONS map itself lives in inventory.service.ts (law 3) — this
// file only holds the vocabulary both sides share.

// Catalogue units. Mirrors v2 §4.5 ("pack|kg|litre|unit").
export const ITEM_UNITS = ['pack', 'kg', 'litre', 'unit'] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

// Every state a movement row can land in. The forward chain (stock_in -> allocated ->
// dispatched -> delivered -> consumed) is the FSM; 'correction' is the special append-only
// branch (ngo_admin-only + mandatory note, enforced in the service).
export const MOVEMENT_STATES = [
  'stock_in',
  'allocated',
  'dispatched',
  'delivered',
  'consumed',
  'correction',
] as const;
export type MovementState = (typeof MOVEMENT_STATES)[number];

// Valid `prev_state` values — the forward (non-correction) states a movement can move OUT
// of. 'stock_in' is the entry point (its own prev_state is NULL).
export const FORWARD_STATES = [
  'stock_in',
  'allocated',
  'dispatched',
  'delivered',
  'consumed',
] as const;
export type ForwardState = (typeof FORWARD_STATES)[number];
