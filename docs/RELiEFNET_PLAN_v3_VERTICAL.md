# RELIEFNET — Vertical-Slice Build Plan (v3)

**Project:** Disaster Relief Coordination & Resource Management System
**Supersedes the build roadmap (Section 8) of v2.** All architecture, schema, and API reference from v2 (Sections 1–7) still hold — this document only changes *how the work is sequenced*.

**What changed from v2's roadmap and why:**
- **Horizontal → vertical.** v2 built the entire backend (phases 0–6) before any UI existed, so there was nothing to demo until phase 7. v3 builds **thin full-stack slices**: every slice ships DB + API + a real screen, deployed, demoable end-to-end.
- **Coordination pulled to the front.** The Resource Coordination domain (needs → offers → matches) is the project's actual thesis, so it lands at **Slice 3–4**, not as a late add-on. By the third slice you can demo cross-NGO coordination.
- **Thin-first, harden-later.** Row-Level Security, the hash-chained audit ledger, and offline sync are **upgrade passes over already-working features**, not prerequisites. The product is never in a broken half-state.
- **Web-first; mobile is an additive track.** "Frontend + backend together" is satisfied with the React web client each slice. The Flutter field client is Slice 11 — nothing earlier depends on it. (Flip this if field capture must be demoed earlier.)
- **Match-by-confirmation.** The matching engine *suggests* candidate offers; a coordinator confirms the handoff. Consistent with the duplicate detector's "flag, don't force" philosophy.

---

## 0. The Three Governing Rules

1. **Deploy at Slice 0, before any feature.** Prove the whole pipeline (CI, Railway API + Postgres, Vercel SPA, CORS, JWT round-trip) on an empty app. Most teams skip this and pay for it later.
2. **Every slice's Definition of Done includes "demoable on the live URL."** If you can't click through it on the deployed app, the slice is not done.
3. **Thin-first, harden-later.** Build the simplest working version (app-layer tenant scoping, plain audit rows, online-only). Security/integrity/offline are explicit later slices that upgrade working features in place.

**Demo narrative arc:** deployed shell → identity → shared disaster frame → **coordination board** → **active matching** → dedup → stock-backed offers → execution → command dashboard → secure → tamper-evident → mobile → offline.

---

## 1. How a 3-Person Team Runs a Vertical Slice

The trap with vertical slicing is splitting by layer ("you do all backend") — that quietly rebuilds the horizontal silo. Instead, **two people pair on the same slice across the stack**, integrating daily; the third runs ahead or behind:

| Role per slice | Responsibility |
| --- | --- |
| **Backend owner** | Migration + repository + service + controller + routes for *this slice only*. Hands the frontend owner a working endpoint + sample payload by mid-slice. |
| **Frontend owner** | The screen + API client wiring + states (loading/empty/error). Consumes a mocked response on day 1, swaps to the live endpoint when ready. |
| **Integrator / next-slice** | Owns deploy + seed data + the demo script for the *current* slice, and writes the schema migration for the *next* slice ahead of time. Rotates each slice. |

Rotate the integrator role so everyone touches deploy and demo prep at least twice.

---

## 2. Slice Map

| Slice | Ships | Demo |
| --- | --- | --- |
| 0 | Walking skeleton, deployed | Log in on a live URL; empty dashboard renders |
| 1 | Identity (NGOs + users) | Admin onboards NGO; NGO admin creates a volunteer |
| 2 | Disaster + campaign frame | Create disaster event; nest a campaign |
| **3** | **Coordination Board** | **Post a need; another NGO sees it** |
| **4** | **Matching loop** | **Confirm a match across two NGOs → fulfilled** |
| 5 | Beneficiaries + duplicate flag | Duplicate CNIC across NGOs → flag |
| 6 | Inventory FSM | Stock-backed offers; correction state |
| 7 | Task FSM | Assign + deliver; rejection → escalation |
| 8 | 3W dashboard + heatmaps | Coverage gaps + unmatched needs |
| 9 | Hardening: RLS | Forged query can't leak cross-tenant |
| 10 | Hardening: audit ledger | Tamper a row → verify fails |
| 11 | Mobile field client | Field user on a phone (Track B) |
| 12 | Offline sync + reconciliation | Airplane mode → reconnect → reconcile |
| 13 | Seed demo + polish | One clean viva path |

---

## 3. The Slices

> Schema/API references point at v2 Sections 4 and 5. Build only the **minimum columns/endpoints** a slice needs; add more in later slices.

### Slice 0 — Walking Skeleton (2–3 days)
**Goal:** the thinnest possible thing that touches every layer and is live on the internet.
- **DB:** Postgres on Railway; `node-pg-migrate` configured; one `users` table (seed one system_admin via a seed migration).
- **API:** Express skeleton with health check, error handler, Zod, `POST /auth/login`, `GET /auth/me`. JWT + bcrypt.
- **UI:** React + Vite + TS + Tailwind + shadcn/ui. Login screen + an empty authenticated dashboard shell behind a `<RequireAuth>` guard. axios client with JWT refresh interceptor.
- **Deploy:** API + Postgres on Railway (release cmd `node-pg-migrate up`); SPA on Vercel with `VITE_API_BASE_URL`.
- **DoD:** open the Vercel URL → log in with the seeded admin → land on an empty dashboard. CORS, auth, and deploy all proven.
- **Seed:** *"Scaffold an Express + pg (raw SQL, no ORM) + Zod API with JWT access/refresh auth and bcrypt, a single seeded users table via node-pg-migrate, and POST /auth/login + GET /auth/me. Then a React + Vite + TS + Tailwind + shadcn/ui SPA with a login screen, an axios client with a JWT refresh interceptor, and a RequireAuth-guarded empty dashboard. Give me Railway + Vercel deploy config."*

### Slice 1 — Identity Vertical (3–4 days)
**Goal:** multi-tenant identity, visible.
- **DB:** `ngos`, extend `users` with `ngo_id` + `role` (v2 §4.1). App-layer tenant scoping via a `tenantScope` middleware reading `ngo_id` from JWT (RLS deferred to Slice 9).
- **API:** `POST /auth/register-ngo`, `GET /ngos`, `PATCH /ngos/:id/status`, `POST /users`, `GET /users`. `authorize(permission)` middleware + permission map (v2 §3.2).
- **UI:** System-admin "NGOs" table (TanStack Table) with vet/suspend; NGO-admin "Staff" table + create-user form; role-gated routes.
- **DoD:** system admin onboards an NGO and its first admin; that admin logs in and creates a volunteer; a volunteer cannot see the NGOs table.
- **Seed:** *"Add ngos + users (ngo_id, role) with a tenantScope middleware (app-layer, JWT ngo_id) and an authorize(permission) middleware backed by a role→permissions map. Endpoints per v2 §5.2. React: a system-admin NGO vetting table and an NGO-admin staff table + create-user form using TanStack Query/Table, role-gated routes."*

### Slice 2 — Disaster & Campaign Frame (2–3 days)
**Goal:** the shared context coordination hangs off.
- **DB:** `disaster_events`, `campaigns`, minimal `locations` (seed a small province→village tree) (v2 §4.2–4.3).
- **API:** `POST/GET /disasters`, `POST/GET /campaigns`, `PATCH /campaigns/:id/status` (v2 §5.3).
- **UI:** system-admin disaster list + create; NGO-admin campaign list + create (campaign nested under a disaster + region picker).
- **DoD:** create "Punjab Monsoon Floods 2026," then an NGO creates a campaign under it scoped to a region.

### Slice 3 — Coordination Board ⭐ (4–5 days)
**Goal:** the project thesis, demoable. The first **cross-tenant** feature.
- **DB:** `resource_needs` (type, quantity, location_id, priority, disaster_id, ngo_id, status `open|matched|fulfilling|fulfilled|closed|cancelled`) and `resource_offers` (type, quantity, region/location, availability_window, visibility `shared|private`, ngo_id, status `available|reserved|committed|delivered|closed`). Both carry `ngo_id` but the board reads **across tenants** (this is the controlled cross-tenant window — keep the policy explicit so Slice 9 RLS carves it out cleanly).
- **API:** `POST /needs`, `GET /needs?status=open` (cross-NGO), `POST /offers`, `GET /offers?status=available` (cross-NGO). Field coordinator raises needs; NGO admin raises offers.
- **UI:** a **Coordination Board** — two columns (Open Needs / Available Offers) visible to all NGOs in a disaster, filterable by type/region. Raise-need and raise-offer forms.
- **DoD:** NGO A posts "100 tents @ Village X (High)"; logged in as NGO B, you see it on the shared board. Visibility alone already closes part of the coordination gap.
- **Seed:** *"Add resource_needs and resource_offers tables (raw SQL, pg) carrying ngo_id but readable cross-tenant via an explicit shared-read repository function (keep it separate from the tenant-scoped functions). Endpoints: POST /needs, GET /needs?status=open, POST /offers, GET /offers?status=available — the GETs return rows from all NGOs in a disaster. React: a Coordination Board with Open Needs / Available Offers columns, type/region filters, and raise-need / raise-offer forms."*

### Slice 4 — Matching Loop ⭐ (4–5 days)
**Goal:** coordination becomes *active*, not just visible.
- **DB:** `resource_matches` (need_id, offer_id, quantity, status `proposed|accepted|rejected|fulfilled`, created_by, confirmed_by). Match FSM in a service.
- **API:** `GET /needs/:id/candidates` (suggested offers by type + region + quantity overlap), `POST /matches` (coordinator proposes/confirms), `PATCH /matches/:id/status`. Need and offer statuses transition in the same transaction as the match.
- **UI:** on a need, a "Candidate offers" panel → confirm → match card with status; both NGOs see the linked status update.
- **DoD:** full **need → candidate → confirm → fulfilling → fulfilled** loop spanning two different NGOs, with both sides' statuses moving in lockstep.
- **Seed:** *"Add resource_matches (need_id, offer_id, quantity, status proposed|accepted|rejected|fulfilled) with an FSM service. GET /needs/:id/candidates suggests offers overlapping on type+region+quantity (suggest only, never auto-create). POST /matches confirms a match and transitions the linked need + offer in one BEGIN/COMMIT. React: a candidate-offers panel on the need detail and a match status card."*

### Slice 5 — Beneficiaries + Duplicate Flag (4–5 days)
**Goal:** cross-NGO de-duplication (coordination of perception).
- **DB:** `beneficiaries`, `aid_records` + `cnic_hash` indexes (v2 §4.4). SHA-256 + pepper util.
- **API:** `GET /beneficiaries/check?cnicHash=`, `POST /beneficiaries` returning a `duplicateFlag` (v2 §5.4) — flag, never block. Create + flag + aid_record in one transaction.
- **UI:** registration form with a duplicate-flag banner showing masked identity + prior aid.
- **DoD:** registering a CNIC already aided by another NGO returns a flag with masked identity and prior aid type/timestamp; the write still succeeds.

### Slice 6 — Inventory FSM (4–5 days)
**Goal:** offers backed by real stock; the matching loop gains integrity.
- **DB:** `inventory_items`, `stock_movements` (v2 §4.5) with the `correction` state.
- **API:** items CRUD, `POST /inventory/movements` (FSM map + `ngo_admin` correction guard + mandatory note), derived quantity-on-hand (v2 §5.5).
- **UI:** NGO-admin inventory grid + movement actions + correction form (ngo_admin only, note required). Link an offer to an inventory item so fulfilling a match moves stock.
- **DoD:** illegal transition rejected; correction without `ngo_admin` → 403; correction without note → 422; fulfilling a match decrements the right stock.

### Slice 7 — Task FSM (3–4 days)
**Goal:** field execution of confirmed work.
- **DB:** `tasks`, `task_transitions` with `rejection_count` + `escalated` (v2 §4.6).
- **API:** `POST /tasks`, `PATCH /tasks/:id/transition` (FSM + rejection cap → escalation at 3), `GET /tasks/:id/history`, `GET /tasks?status=escalated` (v2 §5.6).
- **UI:** task list/detail with transition buttons; escalated-task queue for coordinators/admins.
- **DoD:** full task lifecycle with immutable history; third rejection yields `escalated`; escalated tasks appear in the admin queue.

### Slice 8 — Coordination Dashboard / 3W (3–4 days)
**Goal:** the command picture that ties coordination together — *Who is doing What, Where*.
- **API:** `GET /reports/heatmap?disasterId=`, `GET /reports/coverage-gaps?disasterId=`, plus an open-/unmatched-needs aggregate and a limited cross-NGO "resource availability" summary ("Tents: 2 NGOs have surplus in Punjab" — counts, not exact quantities).
- **UI:** Recharts coverage heatmap, coverage-gap list, unmatched-needs panel, and a 3W matrix view.
- **DoD:** a coordinator sees underserved locations and still-unmatched needs for an active disaster on one screen.

### Slice 9 — Hardening: Row-Level Security (2–3 days)
**Goal:** upgrade app-layer scoping to DB-enforced isolation without breaking anything.
- Enable RLS on all tenant tables; `withTenant()` sets `SET LOCAL app.current_ngo_id` inside the transaction (v2 §3.1).
- **Carve-out:** shared coordination entities (`resource_needs`/`resource_offers` with `visibility='shared'`, `disaster_events`, the beneficiary hash index) get explicit cross-tenant read policies — default-deny stays intact everywhere else.
- **DoD:** a deliberately forged query missing its `WHERE ngo_id` still cannot read another NGO's tenant data; the Coordination Board still works.

### Slice 10 — Hardening: Audit Ledger (2 days)
**Goal:** tamper-evidence over existing transitions.
- `audit_ledger` (append-only, hash-chained) + `auditService.record()` wired into every FSM/service transaction in the same BEGIN/COMMIT (v2 §4.8). `REVOKE UPDATE, DELETE`. `/audit/verify`.
- **UI:** auditor ledger viewer + verify button.
- **DoD:** mutating any ledger row breaks `/audit/verify`; inventory-correction notes appear in metadata.

### Slice 11 — Mobile Field Client (Track B, 5–7 days; parallelizable from Slice 5)
**Goal:** field roles on Android against the proven API.
- Flutter + Riverpod + dio (JWT refresh) + role-gated nav (v2 §6.3). Screens: beneficiary registration with duplicate banner, task list/detail with FSM + escalated badge, field inventory movements. Drift local DB; store `last_known_seq`.
- **DoD:** a field user registers beneficiaries and progresses tasks online from a phone.

### Slice 12 — Offline Sync + Web Reconciliation (5–7 days) ⭐ hardest
**Goal:** offline capture with safe merge — added last because every prior slice already ships working online.
- **Mobile:** Drift outbox; optimistic writes; sync worker → `POST /sync/push`; pull via `GET /sync/pull?since_seq=` with locally stored cursor (v2 §4.7, §6.4).
- **Backend:** idempotent push (`client_uuid`), sequence-based pull, conflict detection.
- **Web:** reconciliation screen (`GET /sync/conflicts`, side-by-side diff, resolve) — build against fixtures first.
- **DoD:** airplane-mode capture → reconnect → non-conflicts merge, conflicts surface on web; `since_seq` guarantees no missed rows.

### Slice 13 — Final Hardening, Seed & Demo Polish (3–5 days)
**Goal:** one clean viva path.
- Test suite in v2 §9 priority order (FSM legality, rejection cap, tenant isolation, duplicate flag, **match loop**, sync idempotency, cursor safety, ledger integrity, RBAC).
- Seed script whose demo path includes: two NGOs, a posted need, a confirmed cross-NGO match, a duplicate-flagged beneficiary, one inventory correction, one escalated task.
- Deploy polish + SRS/design-doc alignment.
- **DoD:** green tests + a single scripted click-through that proves the coordination story end to end.

---

## 4. Why This Sequencing Defends Well in the Viva

- **"Show me it working at any milestone"** → you always can; deploy happened at Slice 0 and every slice is demoable.
- **"Where is the coordination?"** → Slice 3 (shared board) and Slice 4 (active matching), demonstrable before the harder infrastructure even exists.
- **"Is it secure / auditable / offline-capable?"** → yes, and you can show the *before/after* of each hardening slice, which reads as deliberate engineering rather than bolt-on.
- **"What if you'd run out of time?"** → because slices are vertical, an incomplete project is still a *working, smaller* product — not a backend with no face.

---

*End of v3 vertical-slice plan. Feed each slice's "Seed" plus the relevant v2 Section 4/5 schema to Claude Code to build that slice. Keep v2 as the architecture reference; use this document as the build order.*
