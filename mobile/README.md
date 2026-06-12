# RELIEFNET — Mobile Field Client (Slice 11, Track B)

A Flutter field client over the same proven `/api/v1` the React web Control Center
uses. **No backend code lives here** — this is a thin client for the three field
roles (`field_coordinator`, `volunteer`, `data_entry`).

> **Online-only this slice.** Drift (SQLite) is set up as a thin read cache and
> stores `last_known_seq` for later, but the offline **outbox + sync engine is
> Slice 12** and is intentionally not built here (no `core/sync`, no
> `/sync/push`/`/sync/pull`).

## Stack

Flutter 3.x · Riverpod · dio (JWT access/refresh interceptor mirroring the web
axios client) · flutter_secure_storage (tokens) · go_router (role-gated nav) ·
Drift (local read cache).

## Screens (field workflows only)

- **Login** → `POST /auth/login`; tokens stored in the platform keystore; the dio
  interceptor refreshes a 401 once via `POST /auth/refresh`.
- **Dashboard** — role tiles + an escalated-task badge for coordinators.
- **Beneficiaries** — coordinator registration with the cross-NGO **duplicate
  banner** (masked identity + prior aid); read-only list for all field roles;
  verify for coordinators.
- **Tasks** — list + detail with the FSM transition buttons (legal next states
  only, gated by the same per-edge role logic the API enforces), the escalated
  badge, and immutable history.

Inventory is **not** included this slice — every `/inventory` endpoint requires
`inventory:manage`, which no field role holds (it stays on the web for `ngo_admin`).

## Prerequisites

- Flutter 3.x + Dart 3.x (`flutter doctor` green).
- An Android emulator or device (this repo was verified on an Android 15 / API 35
  emulator).

## Run

The API base URL is a compile-time `--dart-define`, defaulting to the local dev
API as reached from an Android emulator (`10.0.2.2` is the emulator's alias for
the host's `localhost`):

```bash
# 1) Start the API on the host (see ../api), e.g. on :4000 with CNIC_PEPPER=dev-pepper

# 2) Run the app on the emulator (default base URL http://10.0.2.2:4000/api/v1)
flutter run -d emulator-5554

# Point at a deployed API instead (no code change):
flutter run -d emulator-5554 --dart-define=API_BASE_URL=https://your-railway-app/api/v1
```

Debug builds enable cleartext HTTP (for `http://10.0.2.2`) via the debug
`AndroidManifest.xml` only; release builds target the HTTPS API.

## Build / verify

```bash
flutter pub get
dart run build_runner build      # Drift codegen (app_database.g.dart)
flutter analyze                  # clean
flutter test                     # FSM helper unit tests
flutter build apk --debug
```

## Demo logins (from `../api/scripts/seed-demo.ts`, password `Demo123!`)

- `coord.hope@demo.reliefnet.org` — field_coordinator (Hope / NGO-A): register,
  verify, assign, verify/reject, clear escalations.
- A `volunteer` is not seeded; create one via the web/API (`POST /users`) to run
  the execute edges (start → submit for verification).

Registering CNIC `36302-3333333-3` under Hope triggers the cross-NGO duplicate
flag (that person was aided by Crescent / NGO-B in the seed).
