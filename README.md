# RELIEFNET

Disaster Relief Coordination & Resource Management System — a multi-NGO platform that
closes the coordination gap during disasters (shared needs/offers board, confirmed matching,
cross-NGO de-duplication, auditable execution).

Built in thin **vertical slices** (DB + API + screen, deployed, demoable). See
[`docs/RELIEFNET_v2.md`](docs/RELIEFNET_v2.md) for architecture/schema/API and
[`docs/RELiEFNET_PLAN_v3_VERTICAL.md`](docs/RELiEFNET_PLAN_v3_VERTICAL.md) for build order.
Engineering laws live in [`CLAUDE.md`](CLAUDE.md).

**Current slice: 0 — Walking Skeleton** (login on a live URL → empty dashboard; proves CI,
Railway API + Postgres, Vercel SPA, CORS, and the JWT round-trip).

## Stack

- **api/** — Node 20 + Express, raw SQL via `pg` (no ORM), Zod, `node-pg-migrate`, JWT + bcryptjs (TypeScript)
- **web/** — React 18 + Vite + TS, Tailwind + shadcn/ui, TanStack Query, axios
- **Layering:** `route → middleware → controller → service → repository → db`. Responses are `{ success, data, error }`.

## Repo layout

```
api/   Express + pg + Zod API           → deploy to Railway
web/   React + Vite SPA                  → deploy to Vercel
docs/  Architecture (v2) + build plan (v3)
.github/workflows/ci.yml                CI: typecheck + build both, migration smoke-test
```

## Run locally

**Prerequisites:** Node 20+ and a running PostgreSQL 16.

```bash
# 1. Database — create one you own and note its connection string
createdb reliefnet_dev

# 2. API
cd api
npm install
cp .env.example .env            # then edit DATABASE_URL + JWT secrets
npm run migrate up              # creates `users` + seeds the system admin
npm run dev                     # http://localhost:4000  (GET /api/v1/health → { db: "up" })

# 3. Web (separate terminal)
cd web
npm install
cp .env.example .env            # VITE_API_BASE_URL=http://localhost:4000/api/v1
npm run dev                     # http://localhost:5173
```

Open http://localhost:5173 and log in with the seeded admin
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, default `admin@reliefnet.org` / `ChangeMe123!`).

### Environment

| Service | Variable | Notes |
| --- | --- | --- |
| api | `DATABASE_URL` | Postgres connection string (Railway injects this) |
| api | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Long random strings, **distinct** from each other |
| api | `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Default `15m` / `7d` |
| api | `CORS_ORIGIN` | Allowed browser origin (the Vercel URL in prod) |
| api | `PORT` | Default `4000` |
| api | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Read by the seed migration at migrate time |
| web | `VITE_API_BASE_URL` | API base incl. `/api/v1` |

## Deploy

**API + Postgres → Railway** (service root `api/`)
1. New project → deploy `api/`, add a **Postgres** plugin (`DATABASE_URL` is auto-injected).
2. Set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (your Vercel URL),
   `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
3. `railway.json` runs `node-pg-migrate up` (migrations + seed) before each release, then
   starts `node dist/index.js`.

**SPA → Vercel** (root directory `web/`)
1. Import the repo, framework **Vite**, root directory `web`.
2. Set `VITE_API_BASE_URL = https://<your-railway-app>/api/v1`.
3. `vercel.json` rewrites all routes to `index.html` so client-side routes don't 404.

After the first Vercel deploy, set Railway's `CORS_ORIGIN` to the real Vercel URL and redeploy.

**Definition of Done:** open the Vercel URL → log in with the seeded admin → land on the empty
dashboard. CORS, auth, and deploy proven.

## CI

`.github/workflows/ci.yml` runs on push + PR: typecheck + build for `api/` and `web/` as
separate jobs, plus a Postgres-container job that applies migrations cleanly. No deploy steps —
Railway and Vercel auto-deploy from their own Git integrations.
