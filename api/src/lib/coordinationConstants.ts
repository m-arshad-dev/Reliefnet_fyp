// Slice 3 Coordination Board — the single backend source of truth for the shared
// enums. Both needs.routes.ts and offers.routes.ts build their Zod `z.enum(...)` from
// these tuples, so the resource-type vocabulary (the key Slice 4's matcher overlaps
// needs <-> offers on) is written down exactly ONCE on the server.

// Broad relief categories shared by needs and offers. Slice 4 overlaps on this `type`.
export const RESOURCE_TYPES = ['shelter', 'food', 'water', 'health', 'wash', 'other'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

// Need urgency — mirrors the disaster-severity scale for a consistent vocabulary.
export const NEED_PRIORITIES = ['low', 'moderate', 'high', 'critical'] as const;
export type NeedPriority = (typeof NEED_PRIORITIES)[number];

// Offer visibility — 'shared' is the only value exposed cross-tenant on the board;
// 'private' rows stay with the owning NGO (the Slice-9 RLS carve-out seam).
export const OFFER_VISIBILITY = ['shared', 'private'] as const;
export type OfferVisibility = (typeof OFFER_VISIBILITY)[number];

// Full status enums live on the columns now; only the initial states ('open' /
// 'available') are reachable this slice — transitions arrive with matching (Slice 4).
export const NEED_STATUSES = [
  'open',
  'matched',
  'fulfilling',
  'fulfilled',
  'closed',
  'cancelled',
] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

export const OFFER_STATUSES = [
  'available',
  'reserved',
  'committed',
  'delivered',
  'closed',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

// Slice 4 Matching Loop — the match FSM's status vocabulary. The TRANSITIONS map and the
// match→(need,offer) status mapping live in resourceMatch.service.ts (law 3); this is just
// the enum both the Zod schemas and the service draw from.
export const MATCH_STATUSES = ['proposed', 'accepted', 'rejected', 'fulfilled'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// Valid PATCH targets only — 'proposed' is the create-time entry state (set by POST
// /matches), never a transition target.
export const MATCH_TRANSITION_TARGETS = ['accepted', 'rejected', 'fulfilled'] as const;
export type MatchTransitionTarget = (typeof MATCH_TRANSITION_TARGETS)[number];
