# DRCRMS — Complete Development & Implementation Plan (v2)

**Project:** Disaster Relief Coordination & Resource Management System
**Type:** Workflow-based multi-NGO coordination platform (no payments, no automated logistics)
**Stack:** React (web control center) · Flutter (mobile field client) · Node.js + Express.js (API) · PostgreSQL (database)
**Team size:** 3+ person team
**Document version:** v2 — updated from v1 with the following confirmed changes:
- ORM replaced: Prisma/Knex dropped in favour of raw SQL via the `pg` driver
- Sync pull race condition fixed: `global_sync_sequence BIGSERIAL` replaces timestamp-based pull
- Inventory FSM: explicit `correction` state added, restricted to `ngo_admin`, mandatory audit note
- Task FSM: `rejection_count` integer + `escalated` state added, rejection cap of 3

**Document purpose:** Single source of truth for architecture, schema, APIs, and phased build. Feed sections of this file directly to Claude Code as build prompts.

---

## 0. How to Read This Document

This plan is ordered so you can build bottom-up: database → backend core → domain modules → mobile → sync → reporting. Each phase ends with a **Definition of Done (DoD)** and a **Claude Code prompt seed** you can paste to kick off that phase. Sections 1–7 are reference; Section 8 is the actual roadmap.

---

## 1. Technology Stack & Rationale

| Layer | Choice | Why it fits DRCRMS |
| --- | --- | --- |
| Mobile client (field) | **Flutter 3.x (Dart)** | Field roles on Android (primary device) + offline-first via local SQLite. |
| Web client (control center) | **React 18 + Vite + TypeScript** | Admin/auditor dashboards: heavy data grids, charts, reconciliation diff UI. Shares the same REST API. |
| Web UI kit | **Tailwind CSS + shadcn/ui + Recharts** | Fast, sleek admin tables, forms, and analytics charts. |
| Web data layer | **TanStack Query + TanStack Table** | Server-state caching + powerful sortable/filterable grids for inventory and audit views. |
| API server | **Node.js 20 LTS + Express.js** | Lightweight REST, fast iteration, large middleware ecosystem for auth/validation. Serves both clients unchanged. |
| Database | **PostgreSQL 16** | Relational integrity for state machines + lifecycles; Row-Level Security (RLS) for tenant isolation; partial/expression indexes for hash lookups. |
| DB driver / query | **`pg` (node-postgres) — raw SQL** | Direct wire-level control over session variables, transaction boundaries, and RLS. No ORM abstraction layer between the backend and PostgreSQL. Migrations managed via `node-pg-migrate` (numbered up/down SQL files). |
| Mobile local DB | **sqflite / Drift** | Offline cache + outbox pattern for the review queue. |
| Auth | **JWT (access + refresh)** + bcrypt password hashing | Stateless API auth; role embedded in token claims. |
| Validation | **Zod** (server) | Schema validation at the controller boundary. |
| Mobile state | **Riverpod** (recommended) or Bloc | Predictable state, testable, good offline-sync ergonomics. |
| Realtime (optional) | **Socket.io** | Live coordinator dashboard alerts for duplicate flags. |
| Reporting/maps | **PostGIS** (optional) + chart lib | Spatial heatmaps; can start with lat/lng numeric columns and add PostGIS later. |

> **Why raw SQL over Prisma:** Three core subsystems — the RLS session-variable wiring, the chained audit ledger writes, and the beneficiary duplicate-flag transaction — all require precise, explicit transaction boundary control. An ORM abstraction layer makes debugging subtle isolation failures significantly harder. With `pg`, every `SET LOCAL`, `BEGIN`, `COMMIT`, and `ROLLBACK` is explicit and visible. `node-pg-migrate` provides versioned up/down migration scripts with a tracking table, fitting cleanly into a Railway release step (`node-pg-migrate up`).

---

## 2. High-Level Architecture

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  WEB CONTROL CENTER (React)   │   │   MOBILE FIELD CLIENT (Flutter)│
│  System Admin · NGO Admin ·   │   │  Coordinator · Volunteer ·    │
│  Auditor                      │   │  Data Entry                   │
│  Data grids · charts ·        │   │  Riverpod · Drift (SQLite) ·  │
│  heatmaps · reconciliation    │   │  outbox / offline sync        │
└──────────────┬────────────────┘   └───────────────┬───────────────┘
               │  HTTPS (JWT)                        │  HTTPS (JWT)
               └──────────────────┬──────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  NODE.JS + EXPRESS API                        │
│  Routes → Middleware (auth, RBAC, tenant) → Controllers       │
│         → Services (business logic) → Repositories            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Domain services: Disaster, Campaign, Beneficiary (hash), │ │
│  │ Inventory FSM, Task FSM, Sync Queue, Audit Ledger        │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────┘
                             │ Raw SQL via pg driver
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         POSTGRESQL 16  (RLS-enforced multi-tenancy)           │
│  Tenant tables · State-machine tables · Append-only ledger    │
│  global_sync_sequence for monotonic pull cursor               │
└─────────────────────────────────────────────────────────────┘
```

**Layering rule (backend):** Routes never touch the DB. Flow is always
`route → middleware → controller → service → repository → db`.
Business rules (state transitions, hash flagging, tenant checks) live **only** in services.

**Raw SQL discipline:** Every repository file exposes explicit functions (`getById`, `insert`, `listByNgo`, etc.). No query builder — plain tagged template strings or parameterised `pg` queries. This makes every SQL statement auditable at a glance, which matters for the RLS session-variable and transaction code that examiners will scrutinise.

---

## 3. Multi-Tenancy & RBAC Design

### 3.1 Tenancy model — Shared schema + discriminator + RLS

Every tenant-scoped row carries `ngo_id`. Isolation is enforced two ways:
1. **Application layer:** A tenant middleware sets `req.tenant.ngoId` from the JWT and every query is scoped.
2. **Database layer (defense in depth):** PostgreSQL **Row-Level Security** policies using a session variable `app.current_ngo_id`, so even a missed `WHERE` clause cannot leak cross-tenant data.

```sql
-- Set per request inside a transaction (raw SQL, explicit)
SET LOCAL app.current_ngo_id = '<uuid>';

-- Example policy
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaigns
  USING (ngo_id = current_setting('app.current_ngo_id')::uuid);
```

Because we use raw `pg`, the session variable is set explicitly at the top of every repository transaction:

```javascript
// repositories/base.js — pattern used everywhere
async function withTenant(client, ngoId, fn) {
  await client.query('BEGIN');
  await client.query('SET LOCAL app.current_ngo_id = $1', [ngoId]);
  try {
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
```

Global entities (Disaster Events, the audit ledger, beneficiary **hash index**, `global_sync_sequence`) are deliberately **cross-tenant readable in controlled ways**.

### 3.2 Roles & permission matrix

| Capability | System Admin | NGO Admin | Field Coord. | Volunteer | Data Entry | Auditor |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Onboard/vet NGOs | ✅ | — | — | — | — | — |
| Create Disaster Events | ✅ | — | — | — | — | — |
| Manage NGO inventory | — | ✅ | — | — | — | — |
| Trigger inventory correction | — | ✅ | — | — | — | — |
| Create campaigns | — | ✅ | — | — | — | — |
| Override duplicate flags | — | ✅ | — | — | — | — |
| Create/assign tasks | — | ✅ | ✅ | — | — | — |
| Execute tasks / record delivery | — | — | — | ✅ | — | — |
| Register beneficiaries | — | — | ✅ | ✅ | ✅ | — |
| Verify beneficiary status | — | — | ✅ | — | — | — |
| Escalate rejected tasks | — | ✅ | ✅ | — | — | — |
| Read audit ledger | ✅ | — | — | — | — | ✅ |
| Read-only global compliance | — | — | — | — | — | ✅ |

Implement as a **permission map** (`role → set of permission strings`) checked by an `authorize(...permissions)` middleware, not scattered `if (role === ...)` checks.

---

## 4. Database Schema (PostgreSQL)

UUID primary keys throughout. `created_at`/`updated_at` on every table. Soft-delete (`deleted_at`) on tenant data; the ledger is **never** mutated.

> **Migration note:** All schema changes are managed by `node-pg-migrate`. Run `node-pg-migrate up` in the release step. Every file in `migrations/` is a numbered up/down SQL script. Never alter a committed migration; always add a new one.

### 4.1 Identity & tenancy

```sql
CREATE TABLE ngos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  registration_no TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending|active|suspended
  vetted_by     UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id        UUID REFERENCES ngos(id),        -- NULL for System Admin / Auditor (global)
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                   -- bcrypt
  role          TEXT NOT NULL,                   -- system_admin|ngo_admin|field_coordinator|volunteer|data_entry|auditor
  region_id     UUID REFERENCES locations(id),   -- scopes coordinators/volunteers
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
```

### 4.2 Location hierarchy (manual mapping, no GPS routing)

```sql
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES locations(id),     -- province → district → tehsil → union council → village
  name        TEXT NOT NULL,
  level       TEXT NOT NULL,                      -- province|district|tehsil|uc|village
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  census_population INTEGER                       -- used for heatmap coverage ratios
);
```

### 4.3 Disaster & campaign hierarchy

```sql
CREATE TABLE disaster_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                      -- "Punjab Monsoon Floods 2026"
  type        TEXT NOT NULL,                      -- flood|earthquake|drought|other
  severity    TEXT NOT NULL,                      -- low|moderate|high|critical
  region_id   UUID REFERENCES locations(id),
  starts_on   DATE NOT NULL,
  ends_on     DATE,
  status      TEXT NOT NULL DEFAULT 'active',     -- active|closed
  created_by  UUID NOT NULL REFERENCES users(id)  -- system admin
);

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id          UUID NOT NULL REFERENCES ngos(id),
  disaster_id     UUID NOT NULL REFERENCES disaster_events(id),
  name            TEXT NOT NULL,
  target_region_id UUID REFERENCES locations(id),
  starts_on       DATE NOT NULL,
  ends_on         DATE,
  status          TEXT NOT NULL DEFAULT 'planning', -- planning|active|completed|paused
  created_by      UUID NOT NULL REFERENCES users(id)
);
```

### 4.4 Privacy-preserving beneficiaries

```sql
CREATE TABLE beneficiaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id        UUID NOT NULL REFERENCES ngos(id),
  cnic_hash     CHAR(64) NOT NULL,                -- SHA-256 hex of normalized CNIC + pepper
  full_name     TEXT NOT NULL,
  household_size INTEGER,
  location_id   UUID REFERENCES locations(id),
  contact_masked TEXT,                            -- store masked, never raw if avoidable
  verified      BOOLEAN NOT NULL DEFAULT false,
  verified_by   UUID REFERENCES users(id),
  registered_by UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cross-NGO duplicate detection index (global, fast)
CREATE INDEX idx_beneficiary_hash ON beneficiaries (cnic_hash);

-- A normalized aid-record table is what duplicate flags read from
CREATE TABLE aid_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  cnic_hash     CHAR(64) NOT NULL,               -- denormalized for fast cross-NGO scan
  ngo_id        UUID NOT NULL REFERENCES ngos(id),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id),
  aid_type      TEXT NOT NULL,                    -- food|shelter|medical|hygiene|other
  delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by   UUID NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_aid_hash ON aid_records (cnic_hash, delivered_at DESC);
```

### 4.5 Inventory lifecycle (state machine)

```sql
CREATE TABLE inventory_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id      UUID NOT NULL REFERENCES ngos(id),
  name        TEXT NOT NULL,                      -- "Food ration pack"
  unit        TEXT NOT NULL,                      -- pack|kg|litre|unit
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0
);

-- Every movement = one immutable row; current state derived from latest movement per batch
CREATE TABLE stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id        UUID NOT NULL REFERENCES ngos(id),
  item_id       UUID NOT NULL REFERENCES inventory_items(id),
  campaign_id   UUID REFERENCES campaigns(id),
  quantity      NUMERIC NOT NULL,
  state         TEXT NOT NULL,
  -- Allowed states: stock_in | allocated | dispatched | delivered | consumed | correction
  -- correction is restricted to ngo_admin role and requires a non-null correction_note
  prev_state    TEXT,
  correction_note TEXT,                           -- REQUIRED when state = 'correction'; NULL otherwise
  moved_by      UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Allowed inventory transitions** (enforced in service, not DB):

```
stock_in → allocated → dispatched → delivered → consumed
```

**Correction movements** break the forward-only rule under strict conditions:
- `state` must be `'correction'`
- Caller's JWT role must be `ngo_admin` (enforced in `inventoryService`, not just middleware)
- `correction_note` must be a non-empty string
- The correction movement is written as a new row (append-only); it does **not** mutate the prior row
- An audit ledger entry is written in the same transaction

```javascript
// services/inventoryService.js — correction guard (pseudocode)
if (toState === 'correction') {
  if (actor.role !== 'ngo_admin') throw new ForbiddenError('Only ngo_admin may issue corrections');
  if (!correctionNote?.trim()) throw new ValidationError('correction_note is required');
}
```

### 4.6 Task state machine

```sql
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id          UUID NOT NULL REFERENCES ngos(id),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id),
  title           TEXT NOT NULL,
  description     TEXT,
  location_id     UUID REFERENCES locations(id),
  status          TEXT NOT NULL DEFAULT 'created',
  -- Allowed statuses: created|assigned|in_progress|pending_verification
  --                   |completed|rejected|escalated
  rejection_count INTEGER NOT NULL DEFAULT 0,     -- increments on each rejected transition
  assigned_to     UUID REFERENCES users(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_transitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id),
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_id    UUID NOT NULL REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Allowed task transitions:**

```
created       → assigned
assigned      → in_progress
in_progress   → pending_verification
pending_verification → completed
pending_verification → rejected   (increments rejection_count; if count reaches 3 → escalated instead)
rejected      → assigned          (only if rejection_count < 3)
escalated     → assigned          (manual coordinator/admin reset; rejection_count does NOT reset automatically)
```

**Rejection cap logic** (enforced in `taskService`):

```javascript
// services/taskService.js — rejection cap (pseudocode)
if (toStatus === 'rejected') {
  const newCount = task.rejection_count + 1;
  if (newCount >= 3) {
    // Force escalation instead of rejection
    toStatus = 'escalated';
  }
  await db.query(
    'UPDATE tasks SET status = $1, rejection_count = $2 WHERE id = $3',
    [toStatus, newCount, task.id]
  );
}
```

> **Why escalated instead of a hard block?** Capping loops at 3 and surfacing an `escalated` flag gives a coordinator visibility that a task is stuck, without permanently closing it. An admin or coordinator can manually reassign from `escalated → assigned` after investigating. The `rejection_count` is preserved across the escalation so the history is not lost.

### 4.7 Offline sync review queue — with monotonic sequence

The v1 plan used a timestamp (`since=`) for the pull cursor. This creates a race condition: two rows committed within the same millisecond window can be missed if the client's pull query lands between them. The fix is a server-side monotonic sequence.

```sql
-- Global monotonic counter — one sequence shared across all syncable entity writes
CREATE SEQUENCE global_sync_sequence START 1 INCREMENT 1;

CREATE TABLE sync_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id          UUID NOT NULL REFERENCES ngos(id),
  client_uuid     UUID NOT NULL,                  -- idempotency key from mobile
  entity_type     TEXT NOT NULL,                  -- beneficiary|aid_record|task_transition|stock_movement
  payload         JSONB NOT NULL,
  seq             BIGINT NOT NULL DEFAULT nextval('global_sync_sequence'),
  -- seq is assigned at insert time on the server; used as the pull cursor
  client_created_at TIMESTAMPTZ NOT NULL,          -- device time (advisory only)
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|merged|conflict|resolved|rejected
  conflict_with   UUID,                            -- references existing server record
  resolved_by     UUID REFERENCES users(id),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_sync_idem ON sync_queue (client_uuid);
CREATE INDEX idx_sync_seq ON sync_queue (seq);   -- fast cursor scans
```

**Pull endpoint contract:**

```
GET /sync/pull?since_seq=<bigint>
```

Returns all `sync_queue` rows where `seq > since_seq`, ordered by `seq ASC`. The mobile client stores the highest `seq` it has received and sends it on the next pull. No timestamps involved in the cursor logic.

```javascript
// repositories/syncRepository.js
async function pullSince(ngoId, sinceSeq) {
  const { rows } = await db.query(
    `SELECT * FROM sync_queue
     WHERE ngo_id = $1 AND seq > $2
     ORDER BY seq ASC`,
    [ngoId, sinceSeq]
  );
  return rows;
}
```

> **Why this is safe:** PostgreSQL sequences are gap-safe for cursor purposes — even if a transaction rolls back and a sequence value is skipped, the client will never receive a lower `seq` than it has already seen. There is no millisecond window where a committed row can be invisible to a subsequent query ordered by `seq`.

### 4.8 Immutable audit ledger (append-only)

```sql
CREATE TABLE audit_ledger (
  id            BIGSERIAL PRIMARY KEY,
  ngo_id        UUID,
  actor_id      UUID,
  action        TEXT NOT NULL,                    -- e.g. task.transition, inventory.move, beneficiary.create
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  metadata      JSONB,
  prev_hash     CHAR(64),                          -- chain to previous row
  row_hash      CHAR(64) NOT NULL,                 -- SHA-256(prev_hash || JSON.stringify(metadata))
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Enforce append-only at DB level
REVOKE UPDATE, DELETE ON audit_ledger FROM PUBLIC;
```

> **Tamper-evidence:** each row hashes the previous row's hash → a broken chain reveals tampering. `/audit/verify` recomputes the chain on demand. Every inventory correction writes a ledger entry in the same transaction as the `stock_movements` insert — the note text is included in `metadata`, making it tamper-evident too.

---

## 5. REST API Design

Base: `/api/v1`. All responses `{ success, data, error }`. All protected routes require `Authorization: Bearer <jwt>`.

### 5.1 Auth
```
POST   /auth/register-ngo          # system admin onboards NGO + first NGO admin
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
```

### 5.2 Admin & tenancy
```
GET    /ngos                       # system admin
PATCH  /ngos/:id/status            # vet/suspend
POST   /users                      # ngo admin creates staff
GET    /users
PATCH  /users/:id
```

### 5.3 Disaster & campaign
```
POST   /disasters                  # system admin
GET    /disasters
GET    /disasters/:id
POST   /campaigns                  # ngo admin
GET    /campaigns
PATCH  /campaigns/:id/status
```

### 5.4 Beneficiaries (with duplicate flagging)
```
POST   /beneficiaries              # returns 201 + duplicate_flag object if hash hit
GET    /beneficiaries
GET    /beneficiaries/:id
PATCH  /beneficiaries/:id/verify
GET    /beneficiaries/check?cnicHash=...   # pre-check before save
```
**Duplicate response shape:**
```json
{
  "success": true,
  "data": { "beneficiary": { } },
  "duplicateFlag": {
    "flagged": true,
    "maskedIdentity": "****-*****67-*",
    "priorAid": [{ "ngo": "NGO-B", "aidType": "food", "deliveredAt": "..." }]
  }
}
```

### 5.5 Inventory
```
POST   /inventory/items
GET    /inventory/items
POST   /inventory/movements        # state transition; service validates legality + correction guard
GET    /inventory/movements?itemId=
```

**Correction movement request body:**
```json
{
  "itemId": "uuid",
  "quantity": 10,
  "toState": "correction",
  "prevState": "delivered",
  "correctionNote": "Batch SP-2026-04 incorrectly marked delivered; reverting to dispatched."
}
```
Returns `403 Forbidden` if caller is not `ngo_admin`. Returns `422 Unprocessable` if `correctionNote` is absent.

### 5.6 Tasks
```
POST   /tasks
GET    /tasks?status=&assignedTo=
PATCH  /tasks/:id/transition       # { toStatus, note } — validated by FSM + rejection cap
GET    /tasks/:id/history
GET    /tasks?status=escalated     # coordinator/admin view of stuck tasks
```

**Transition response when cap forces escalation:**
```json
{
  "success": true,
  "data": {
    "taskId": "uuid",
    "requestedStatus": "rejected",
    "actualStatus": "escalated",
    "rejectionCount": 3,
    "message": "Rejection cap reached. Task escalated for coordinator review."
  }
}
```

### 5.7 Sync
```
POST   /sync/push                  # array of offline ops (idempotent via client_uuid)
GET    /sync/pull?since_seq=<bigint>   # server changes since sequence number (NOT timestamp)
GET    /sync/conflicts             # reconciliation list (consumed by Web Control Center)
POST   /sync/conflicts/:id/resolve # { resolution: keep_server|keep_client|merge } — web only
```

### 5.8 Reporting
```
GET    /reports/heatmap?disasterId=     # aid density vs census per location
GET    /reports/coverage-gaps?disasterId=
GET    /audit/ledger?entityType=&actorId=  # auditor / system admin only
GET    /audit/verify                       # recompute hash chain integrity
```

---

## 6. Client Platforms — Web Control Center + Mobile Field Client

DRCRMS ships **two thin clients over one shared REST API**. Neither client holds business logic; both call the same `/api/v1` endpoints. The split is by operational environment, not by feature duplication.

### 6.1 Platform–role split matrix

| Platform | Roles | Primary screens | Environment |
| --- | --- | --- | --- |
| 🌐 **Web Control Center** (React) | System Admin, NGO Admin, Auditor | NGO onboarding/vetting, bulk inventory ingestion, campaign config, analytics + coverage heatmaps, audit-ledger validation, **conflict reconciliation**, escalated task review | Stable internet, large screen, data-heavy tables and charts |
| 📱 **Mobile Field Client** (Flutter) | Field Coordinator, Volunteer, Data Entry | Beneficiary registration (+ duplicate-flag UI), task execution & verification, delivery recording, offline capture & sync, "N conflicts / N escalated" badge | Intermittent connectivity, portable, camera for evidence, GPS tagging |

> **Reconciliation placement (decision):** conflict reconciliation lives on the **web portal**, not mobile — the side-by-side diff genuinely needs screen real estate. The mobile app surfaces a "pending sync / N conflicts" indicator only; resolution happens on web.

### 6.2 Web Control Center architecture (React)

```
src/
├── main.tsx
├── lib/
│   ├── api/            # axios/fetch client + JWT refresh interceptor
│   ├── auth/           # token store, <RequireRole> route guards
│   └── query/          # TanStack Query client + keys
├── features/
│   ├── auth/           # login
│   ├── ngos/           # system-admin: onboard/vet NGOs
│   ├── users/          # ngo-admin: staff management
│   ├── disasters/      # system-admin: disaster events
│   ├── campaigns/      # ngo-admin: campaign config
│   ├── inventory/      # bulk ingestion + TanStack Table grids + correction form
│   ├── reconciliation/ # sync conflict diff + resolve
│   ├── tasks/          # escalated task queue for coordinator/admin review
│   ├── reports/        # Recharts heatmaps + coverage-gap charts
│   └── audit/          # auditor: ledger viewer + /audit/verify
├── components/ui/      # shadcn/ui primitives
└── routes.tsx          # role-gated routing
```

### 6.3 Mobile Field Client folder structure (Flutter)

```
lib/
├── main.dart
├── core/
│   ├── network/        # dio client, interceptors (jwt, refresh, retry)
│   ├── auth/           # token storage (flutter_secure_storage), role guard
│   ├── db/             # Drift database, DAOs, outbox
│   └── sync/           # sync engine (outbox drain + pull using since_seq cursor)
├── features/
│   ├── auth/
│   ├── dashboard/      # role-based field home; shows conflicts badge + escalated badge
│   ├── beneficiaries/  # register + duplicate flag UI
│   ├── tasks/          # list, detail, transition actions; escalated indicator
│   ├── inventory/      # field movements only: dispatched → delivered/consumed
│   └── sync/           # pending-sync + conflict indicator (resolution is on web)
└── shared/             # widgets, theme, constants
```

### 6.4 Offline-first flow (outbox pattern)

1. Every write goes to local Drift first → UI updates instantly (optimistic).
2. The write is appended to a local **outbox** table with a `client_uuid`.
3. A background sync worker drains the outbox to `POST /sync/push` when online.
4. Server returns per-op status (`merged` / `conflict`); conflicts are resolved on web only.
5. `GET /sync/pull?since_seq=<last_known_seq>` hydrates server-side changes back into local Drift. The mobile client stores `last_known_seq` locally and updates it after each successful pull.

> **Never trust device clocks for overwrites.** Device time is advisory metadata only (`client_created_at`). The `seq` cursor is server-assigned and monotonic.

### 6.5 Role-based UI

Each client gates screens by the JWT role claim. **Mobile:** volunteers see task execution + beneficiary capture; coordinators add assignment + verification and can see the escalated-task badge. **Web:** system admins see NGO onboarding + disaster events; NGO admins see staff, campaigns, inventory ingestion, correction form, reconciliation, and escalated task queue; auditors get read-only ledger + verify.

---

## 7. Cross-Cutting Technical Notes

**CNIC hashing.** Normalize (strip dashes/spaces) → prepend a server-side **pepper** (env secret) → `SHA-256` → store hex. Never store raw CNIC. The pepper prevents trivial rainbow-table reversal of a known 13-digit space.

**RBAC middleware.** `authenticate` (verify JWT) → `tenantScope` (set `app.current_ngo_id` via `SET LOCAL`) → `authorize('perm.string')`. Compose per route. Because `tenantScope` uses `SET LOCAL` inside an explicit transaction, it is safe for connection pooling.

**State machines.** Keep a single `TRANSITIONS` constant map per machine (inventory, task). The service rejects any `(from → to)` not in the map. The inventory service additionally enforces the correction guard inline. The task service enforces the rejection cap inline.

```javascript
// Inventory FSM map
const INVENTORY_TRANSITIONS = {
  stock_in:   ['allocated'],
  allocated:  ['dispatched'],
  dispatched: ['delivered'],
  delivered:  ['consumed'],
  // 'correction' is not in this map — it is handled as a special branch in inventoryService
};

// Task FSM map
const TASK_TRANSITIONS = {
  created:              ['assigned'],
  assigned:             ['in_progress'],
  in_progress:          ['pending_verification'],
  pending_verification: ['completed', 'rejected'],
  rejected:             ['assigned'],
  escalated:            ['assigned'],  // manual reset by coordinator/admin
};
```

**Transactions.** Every multi-step operation (beneficiary-create + duplicate-check + aid-record + ledger entry; inventory-move + ledger entry; task-transition + rejection-count update + ledger entry) runs inside one explicit `BEGIN / COMMIT` block via `pg`. Partial writes are impossible.

**Audit everywhere.** Every state-changing service call appends to `audit_ledger` with the chained hash inside the same transaction. Centralize in an `auditService.record(client, { action, entityType, entityId, metadata, actorId, ngoId })` helper that computes `prev_hash` and `row_hash` before inserting.

**Pagination.** All list endpoints use keyset (cursor) pagination on `id` or `seq`, not `OFFSET`. TanStack Table on the web consumes the cursor response. This keeps query performance stable as tables grow.

---

## 8. Phased Build Roadmap

> 3+ person team. Recommended team division per phase is noted. Each phase is independently demoable.

### Phase 0 — Foundations (3–4 days)
**Owner: Backend lead**
- Repo setup (monorepo or separate `api/` + `web/` + `mobile/`).
- PostgreSQL init; `node-pg-migrate` configured; base migrations for `ngos`, `users`, `locations`.
- Express skeleton: error handler, request logging, Zod validation, health check.
- JWT auth (login/refresh) + bcrypt + `authenticate` middleware.
- `withTenant()` helper (Section 3.1) wired into all repository calls.
- **DoD:** can register an NGO + admin, log in, hit a protected `/auth/me`; `SET LOCAL app.current_ngo_id` fires on every authenticated request.
- **Claude Code seed:** *"Scaffold an Express + pg (raw SQL) + Zod API with JWT access/refresh auth, bcrypt, a withTenant(client, ngoId, fn) helper that issues SET LOCAL app.current_ngo_id inside a BEGIN/COMMIT block, and an authorize(permissions) middleware. Use the users/ngos schema in Section 4.1. No ORM."*

### Phase 1 — Tenancy & RBAC (3–4 days)
**Owner: Backend lead**
- Full permission map (Section 3.2) + `authorize` middleware.
- PostgreSQL RLS policies on all tenant tables.
- System-admin NGO vetting endpoints.
- **DoD:** cross-tenant read is impossible even with a forged `WHERE`; permission matrix enforced for all six roles.

### Phase 2 — Disaster & Campaign hierarchy (2–3 days)
**Owner: Backend lead or second dev**
- CRUD for disaster events (system admin) and campaigns (NGO admin).
- Location hierarchy seeding (province → village) via migration seed file.
- **DoD:** NGO admin creates a campaign nested under a global disaster event.

### Phase 3 — Beneficiary + duplicate engine (4–5 days) ⭐ core differentiator
**Owner: Backend lead**
- SHA-256 + pepper hashing util; `beneficiaries` + `aid_records` tables.
- `/beneficiaries/check` pre-check and create-with-flag response.
- Flag-not-block logic: return masked prior-aid info, never block.
- **DoD:** registering a CNIC already aided by another NGO returns a duplicate flag with masked identity + prior aid type/timestamp.
- **Claude Code seed:** *"Implement a beneficiary service using pg (raw SQL, no ORM) that hashes a normalized CNIC with a pepper, checks the global aid_records index for cross-NGO matches, and returns a duplicateFlag with masked identity and prior aid history — without blocking the write. Wrap create + flag + ledger in one explicit BEGIN/COMMIT transaction."*

### Phase 4 — Inventory lifecycle FSM (3–4 days)
**Owner: Backend lead or second dev**
- Items + `stock_movements`; transition map enforcement.
- Correction movement with `ngo_admin` guard and mandatory `correction_note`.
- Quantity-on-hand derivation from movement rows.
- **DoD:** illegal transitions (e.g. `stock_in → delivered`) are rejected; correction without `ngo_admin` role returns 403; correction without note returns 422.

### Phase 5 — Task state machine (3–4 days)
**Owner: Second dev**
- Tasks + `task_transitions`; FSM enforcement; assignment.
- `rejection_count` increment on every rejection; cap at 3 forces `escalated`.
- `escalated → assigned` manual reset path.
- **DoD:** full task lifecycle with immutable transition history; third rejection produces `escalated` status; escalated tasks visible in admin queue.

### Phase 6 — Audit ledger (2 days)
**Owner: Backend lead**
- `auditService.record()` chained-hash helper wired into all FSM/service transactions.
- `/audit/verify` chain integrity endpoint.
- Inventory corrections write to ledger with `correction_note` in metadata.
- **DoD:** tampering with any ledger row breaks `/audit/verify`; correction notes are tamper-evident.

### Phase 7 — Mobile Field Client core (5–7 days)
**Owner: Mobile dev(s)**
Build **only the field-role workflows** (Coordinator, Volunteer, Data Entry).
- Auth flow, secure token storage (`flutter_secure_storage`), dio + refresh interceptor.
- Role-based field dashboard + navigation guards.
- Beneficiary registration screen with duplicate-flag banner.
- Task list/detail with transition actions; escalated-task indicator.
- Field inventory movements.
- Drift local DB schema mirrors server schema; `last_known_seq` stored locally.
- **DoD:** a field user can register beneficiaries and progress tasks online; escalated tasks show a distinct badge.
- **Claude Code seed:** *"Build a Flutter app with Riverpod + dio (JWT refresh interceptor) and role-gated navigation for field_coordinator/volunteer/data_entry. Screens: beneficiary registration with a duplicate-flag banner, task list + detail with FSM transition buttons and an escalated-task badge. Drift local DB. No admin/analytics screens."*

### Phase 7.5 — Web Control Center (5–7 days)
**Owner: Web dev(s), parallel with Phase 7**
Focused React (Vite + TS) sprint for **admin roles** (System Admin, NGO Admin, Auditor).
- Auth + `<RequireRole>` guards.
- NGO onboarding/vetting tables (system admin); staff + campaign management (NGO admin).
- Bulk inventory ingestion forms + TanStack Table grids.
- Inventory correction form (ngo_admin only; requires note field).
- Escalated task queue view (coordinator/admin).
- Audit-ledger viewer + `/audit/verify` button (auditor).
- **DoD:** NGO admin can submit a correction movement with a note; auditor verifies ledger chain; escalated tasks visible in admin queue.
- **Claude Code seed:** *"Scaffold a React + Vite + TypeScript admin SPA with Tailwind + shadcn/ui, TanStack Query + Table, axios with JWT refresh, and role-gated routes for system_admin/ngo_admin/auditor. Build NGO vetting, staff management, inventory ingestion grids, a correction-movement form (ngo_admin only, mandatory note), an escalated-task queue, and an audit-ledger viewer against the /api/v1 endpoints in Section 5."*

> **Parallel sprint note:** Web (Phase 7.5) and Mobile (Phase 7) can run simultaneously. Both call the same API. The web team can mock API responses initially; by the time the backend phases 3–6 are complete, both clients can integrate against the live API.

### Phase 8 — Offline sync + web reconciliation (5–7 days) ⭐ hardest, highest marks
**Owner: Mobile dev (outbox) + Web dev (reconciliation UI) — parallel**
- **Mobile:** Drift outbox schema; optimistic local writes; sync worker draining outbox to `POST /sync/push`; `since_seq` cursor stored in local preferences; pull via `GET /sync/pull?since_seq=`.
- **Backend:** idempotent push endpoint; sequence-based pull query (Section 4.7); conflict detection logic.
- **Web:** reconciliation screen consuming `GET /sync/conflicts` with side-by-side diff + resolve; build against mock data first, wire to live API second.
- Mobile "N conflicts pending" indicator.
- **DoD:** capture data in airplane mode → reconnect → server merges non-conflicts; conflicts surface in the web portal for human resolution; `since_seq` cursor guarantees no missed records.
- **Parallelisation strategy:** Web dev builds reconciliation UI against hardcoded fixture data from day one. Mobile dev builds the outbox and sync worker independently. Both integrate against the backend push/pull endpoints once Phase 6 is complete. This prevents either client from blocking the other.

### Phase 9 — Reporting & heatmaps (3–4 days)
**Owner: Web dev**
- Aid-density vs census coverage query; coverage-gap endpoint (API).
- Recharts dashboards + anonymized spatial heatmap on the web portal.
- **DoD:** web dashboard shows underserved locations for an active disaster.

### Phase 10 — Hardening & docs (3–5 days)
**Owner: All**
- Tests (auth, RBAC, FSM legality, duplicate flag, sync idempotency, rejection cap, correction guard).
- Seed/demo data script for viva (include at least one correction movement and one escalated task in the demo path).
- Deployment (Railway for API + Postgres; Vercel/Netlify for React SPA).
- Final SRS/design doc alignment with this plan.
- **DoD:** clean demo path + green test suite.

---

## 9. Testing Strategy (priority order)

1. **State-machine legality** — every illegal inventory transition rejected; correction without ngo_admin returns 403; correction without note returns 422.
2. **Task rejection cap** — third rejection produces `escalated`, not `rejected`; rejection_count persists correctly.
3. **Tenant isolation** — RLS blocks cross-NGO reads.
4. **Duplicate flagging** — cross-NGO hash hit returns flag, never blocks.
5. **Sync idempotency** — replaying the same `client_uuid` does not double-write.
6. **Sync cursor** — `since_seq` pull never misses a committed row; gaps in sequence values do not cause data loss.
7. **Ledger integrity** — `/audit/verify` detects a mutated row; correction note visible in ledger metadata.
8. **RBAC** — each role can only hit its permitted endpoints.

---

## 10. Deployment Notes

- **API + DB:** Railway (managed Postgres + Node service). Set env vars: `DATABASE_URL`, `JWT_SECRET`, `CNIC_PEPPER`. Release command: `node-pg-migrate up` (runs pending migrations before server start).
- **Web Control Center:** deploy the React build to Vercel or Netlify (static SPA); set `VITE_API_BASE_URL` to the Railway API URL.
- **Migrations:** committed to `migrations/` as numbered SQL files. Never edit a deployed migration; add a new one.
- **Mobile:** build a release APK for the viva; set the API base URL via `--dart-define=API_BASE=https://...`.
- **Secrets:** never commit the pepper, JWT secret, or database URL. Rotate before the submission demo if exposed.

---

## 11. Viva Defense Cheat-Sheet

- **Why raw SQL instead of Prisma?** Three subsystems — RLS session variables, chained audit writes, and the beneficiary duplicate transaction — require explicit, visible transaction boundaries. An ORM adds an opaque layer that makes debugging isolation failures during a live demo significantly harder. With `pg`, every `SET LOCAL`, `BEGIN`, and `COMMIT` is in plain sight.
- **Why both a web portal and a mobile app?** Deliberate decoupling: Web Control Center handles desk work (admin tables, bulk ingestion, analytics, audit validation, conflict reconciliation) on large screens with stable internet. Mobile Field Client handles offline data capture in low-connectivity zones. A single app would degrade both experiences.
- **Why no payments?** Deliberate scope boundary — DRCRMS is an orchestration/tracking engine. Keeps feasibility tight and security surface small.
- **How do you protect identity?** CNICs are SHA-256 hashed with a server pepper; raw IDs are never stored, yet cross-NGO duplicates are still detectable via the hash index.
- **Why flag, not block?** Humanitarian judgment must stay with coordinators; the system surfaces evidence, humans decide.
- **What makes the audit log trustworthy?** Append-only + hash-chained rows + DB-level `REVOKE UPDATE, DELETE`. Any edit breaks the chain, which `/audit/verify` detects. Correction notes are embedded in ledger metadata, making them tamper-evident too.
- **How does offline work safely?** Outbox pattern + server-assigned monotonic `seq` cursor. Device clocks are advisory only. Conflicts go to human reconciliation on web; the `since_seq` cursor guarantees zero missed records regardless of timing.
- **How do you prevent infinite task rejection loops?** `rejection_count` increments on every rejection. At 3, the service forces `escalated` status instead of `rejected`, surfacing the task to a coordinator or admin for manual review. The count persists so the history is not hidden.
- **How do you handle inventory mistakes in the field?** Correction movements are a first-class FSM state, restricted to `ngo_admin`, require a mandatory written note, and write to the audit ledger in the same transaction. No row is ever mutated — the correction is a new append-only row.

---

*End of plan v2. Build phases sequentially; run parallel sprints for Phases 7 and 7.5, and for the mobile/web halves of Phase 8. Paste each phase's "Claude Code seed" plus the relevant Section 4/5 schema to generate that slice.* frist of all our goal is to remove the coordination gap during hte disaster or any thing like that and this is the porject we are going to ubild the question is is this complete nad cna remvoe hte cooridination gap effectively 