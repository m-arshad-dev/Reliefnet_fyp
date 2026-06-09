# DRCRMS — Build Context for Claude Code

## Read first
- Architecture/schema/API reference: docs/DRCRMS_v2.md  (Sections 1–7)
- Build order (what to build when):    docs/DRCRMS_PLAN_v3_VERTICAL.md
- We build ONE slice at a time, in order. Current slice: <update each time>

## Non-negotiable laws (do not violate without asking)
1. Raw SQL via the `pg` driver only. No ORM, no query builder.
2. Layering: route → middleware → controller → service → repository → db.
   Routes never touch the DB. Business rules live ONLY in services.
3. State machines (inventory, task, match) are TRANSITIONS maps in the service;
   reject any (from→to) not in the map.
4. Every multi-step write is one explicit BEGIN/COMMIT. No partial writes.
5. All responses: { success, data, error }. All lists: keyset pagination, not OFFSET.
6. Thin-first, harden-later: do NOT add RLS, the hash-chained ledger, or offline
   sync until their dedicated slice (9, 10, 12). Use app-layer tenant scoping for now.

## Stack (pinned — do not substitute)
Node 20 + Express, pg (raw SQL), Zod, node-pg-migrate, JWT+bcrypt,
React 18 + Vite + TS, Tailwind + shadcn/ui, TanStack Query + Table, axios.

## Definition of Done for every slice
The slice is done only when its DoD demo works on the deployed URL — not when the code compiles.