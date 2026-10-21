# Murago Coffee ERP — Phase 2 & 3 Verification (FINAL)

Verified 2026-10-21 (Africa/Addis_Ababa). Phase 1 record: `VERIFICATION.md`.
Stack: Django 5.2 + DRF (**TokenAuthentication** — chosen over JWT: one revocable
token per field device/user) + React 19/Vite/TypeScript/Tailwind 4 SPA served by
the same Django service at `/app/` (WhiteNoise + SPA fallback view).

## Live deployment (all curl-verified 2026-10-21 ~13:43–13:46 EAT)

| Item | Result |
|---|---|
| Live URL | **https://murago-coffee-erp.onrender.com** (app: `/app/`, API: `/api/`, health: `/health/`, schema: `/api/schema/`, docs UI: `/api/docs/`) |
| Render service | `murago-coffee-erp` — `srv-dbc9aa61egvs739u4840`, free, Frankfurt, auto-deploy on `master` |
| GitHub | **https://github.com/kyuti675rtdg/murago-coffee-erp** (public, `master`, 186 tracked files at final push) |
| Database | Logical DB **`murago`** on the shared `hms-db` Postgres 16 instance (Frankfurt). A NEW free DB was attempted first and rejected by Render: `cannot have more than one active free tier database` — shared-instance pattern (same as Orbit's `orbiterp`) used instead, created on-service by `scripts/ensure_db.py` |
| **PostGIS (Phase-1 gap CLOSED)** | `GET /api/postgis/` (authenticated) → `{"postgis": true, "postgis_version": "3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1", "geometry_smoke": "POINT(38.4167 6.6)"}` — `CREATE EXTENSION postgis` + `postgis_version()` + `ST_GeomFromText` all executed live on the production DB |
| GIS storage note | `MURAGO_USE_GIS=0` in production by decision: FarmPlot geometry is stored as canonical GeoJSON (`boundary_geojson`, + boundary/centroid JSON) so model == migration == engine in every environment (see "Deploy incident" below). Native `geometry(Polygon,4326)` DDL remains in `sql/phase1_schema.sql` for a future GeoDjango migration |
| Health | `GET /health/` → `{"service": "murago-coffee-erp", "phase": 3, "status": "ok"}` |
| `/app/` | HTTP 200 text/html; JS bundle `/app/assets/index-*.js` HTTP 200 (1,956,074 bytes); `manifest.json` HTTP 200 |
| Login | `POST /api/auth/login/` admin → 200, token issued, profile returns role `admin`, `station_ids: null` (all stations) |
| Seeded API data | `GET /api/lots/` → 2 lots (`MUR-20261021-W-001` drying 980 kg, `MUR-20261021-W-002` receiving→pulping); `GET /api/dashboard/` → lots_total 2, cherry 490 kg, open contracts 1, avg fuel ratio 0.02 |
| **FSM live test** | `POST /api/lots/{W-002}/transition/ {"to_stage":"drying"}` → **HTTP 400** `Illegal lot transition receiving -> drying: … next allowed stage is pulping.` · `{"to_stage":"pulping"}` → **HTTP 200**, `pulping_date` stamped |
| Fuel/water live | `GET /api/fuel-entries/` → ratio `0.02000`, anomaly false; seeded attendance sheet `2/2018` status `verified` |
| Keep-alive | Cron `murago-keepalive` created (10-min interval ping of `/health/`, silent on success) — free tier sleeps after ~15 min idle, first hit after sleep can take ~1 min |

## Demo logins (DEMO ONLY — rotate before any real client use)

| Username | Password | Role | Signature PIN |
|---|---|---|---|
| `admin` | `MuragoAdmin2026!` | Admin (all stations) | `1234` |
| `supervisor` | `MuragoAdmin2026!` | Station Supervisor (Murago) | `1234` |
| `operator` | `MuragoAdmin2026!` | Machine Operator (Murago) | `1234` |
| `qgrader` | `MuragoAdmin2026!` | Q-Grader (Murago) | `1234` |
| `finance` | `MuragoAdmin2026!` | Finance Manager (Murago) | `1234` |

Seed (idempotent `seed_demo`, runs at every service start): Murago station (MUR)
+ Addis warehouse (ADD), 2 farmers + GeoJSON plot, collection center + intake
(490 kg payable), lot mid-pipeline at Drying, lot 2 walked legally to Receiving,
drying beds 12/13, fuel entry (0.02 L/kg) + water entry (6.0 L/prev-kg) computed
by the real calculators, 3 workers + dual-verified attendance sheet (2/2018),
Hamburg buyer + signed contract SC-2026-001.

## Phase 2 — API (tests: 29/29 pass)

```
$ python manage.py check            → System check identified no issues (0 silenced).
$ python manage.py test tests       → Ran 29 tests — OK  (17 Phase-1 engine + 12 new API)
```
New API tests (`tests/test_api.py`): auth required (401), login ok/bad,
RBAC denial (machine operator POST + GET payroll → 403), station scoping
(supervisor sees only own-station farmers; admin sees all), FSM endpoint
illegal skip → 400 + legal → 200, fuel entry returns computed `0.02000`,
water entry returns `6.00000` from previous-day kg, payroll blocked without
dual verification → 400, full flow verify → generate (gross 3000.00) →
same-user approve 400 → distinct approve 200, sync push idempotency
(duplicate ack, 1 queue row), dashboard + OpenAPI schema 200.

API surface: **85 viewsets (one per model) = 380 API URL patterns** incl.
format suffixes; **13 engine action endpoints**: lot `transition`, `advance`,
`split`, `blend`, `traceability`; drying-handover `dual-sign`; stock-receipt
`dual-sign`; stock-transfer `dual-sign` (returns shrinkage); cupping `decide`
(approve/reject for export release); attendance-sheet `verify`,
`generate-payroll`; payroll-period `approve`; payroll-line `sign-recipient`.
Plus `/api/dashboard/`, `/api/reports/run/`, `/api/lot-costing/{id}/`,
`/api/postgis/`, `/api/sync/push/` + `/api/sync/pull/?since=`,
`/api/auth/login|logout|me/`, `/api/users/`, `/api/schema/` (drf-spectacular).
RBAC: `api/permissions.py` WRITE_MATRIX / READ_RESTRICTED per brief role;
station-scoped querysets via `UserStationRole`; AuditLog written on API
create/update/delete. Validation: intake gross ≥ tare & deduction range
(net/payable/total computed on save), moisture 10.5–11.5 warning flag on
moisture readings + physical analyses, cupping attributes 0–10, contract
allocation capacity + locked-allocation immutability, GeoJSON plot check.

## Phase 3 — Frontend (build verified)

```
$ cd frontend && npm install   → added 127 packages (AG Grid 34, Leaflet, Recharts all installed cleanly — no substitution needed)
$ npm run build                → tsc -b OK · vite build OK · dist/index.html 0.60 kB, CSS 295.65 kB, JS 1,955.37 kB (gzip 552 kB)
$ python manage.py collectstatic → 169 static files copied
```
**23 module pages** in the brief's sidebar order, all calling the Phase 2 APIs
(TanStack Query; Zustand auth store; login wired to `/api/auth/login/`):
Dashboard (KPIs + FSM-stage bar chart + contract position), Farmers + Leaflet
polygon map, Collection intake terminal (live net/payable + QR receipt code),
Procurement, Processing Kanban (FSM columns, Advance + move-to with illegal-move
error toast) + Drying Handover form (PIN pads, moisture-band warning),
Dry Mill + grading, Traceability tree (DAG nodes/edges), Lot split/blend studio,
Quality (physical worksheet + cupping form with live Recharts radar + decide),
Warehouse bin map + transfer dual-sign, Fuel register (የነዳጅ ፍጆታ መከታተያ ቅጽ) +
Water register (የውሃ ፍጆታ መከታተያ ቅጽ) with live ratio preview, HR workers +
**30-day attendance on real AG Grid Community** (inline editing, Controlled/
Verified PIN sign-off), Payroll (ጠቅላላ ክፍያ/ተቆራጭ/የተጣራ ክፍያ, generate/approve,
recipient tablet sign-off), Buyers/contracts, Export stencil preview +
containers/documents, Logistics + shrinkage, Finance GL/AR-AP + lot costing,
Payments + forex, Inventory + audits, BI report runner + JSON export,
Mobile Field (offline capture → IndexedDB queue with UUIDv7, sync push,
conflict list, online/offline indicator), System Config, Users/Role matrix +
hash-chained audit log.
PWA: `manifest.json` + service worker (app-shell + API GET cache, background
sync tag) — installable. Demo-data fallback exists ONLY in dev builds
(`import.meta.env.DEV`) and is banner-labelled; production bundles call real APIs.

## Deploy incident (fixed, recorded honestly)

First deploy (`dep-dbc9aam1egvs739u4980`) FAILED: env vars passed inside the
service-creation payload were not persisted by the Render API, so the service
booted on SQLite; additionally `farmers` GIS detection disagreed with the DB
engine and the seed crashed (`'DatabaseOperations' object has no attribute
'select'`). Fixes: (1) env vars set via the dedicated
`PUT /v1/services/{id}/env-vars` endpoint (verified all 7 set); (2) GIS becomes
a single source of truth — `murago/settings.py` `GIS_AVAILABLE` (now using
Django's own HAS_GDAL/HAS_GEOS detection) consumed by `farmers/models.py`;
(3) `MURAGO_USE_GIS=0` pinned in production. Second deploy
`dep-dbc9d1o473hc73fhhe50` → **live**.

## Honest gaps

- Native PostGIS geometry *columns* are not used at runtime (GeoJSON storage
  by the decision above); the PostGIS extension itself is enabled and verified
  live. Upgrading to GeoDjango fields needs a migration + GDAL-standard image.
- JS bundle is a single 1.95 MB chunk (gzip 552 kB) — code-splitting is a
  performance follow-up, not a functional gap.
- WebSerial scale capture, QR/barcode *printing*, and PDF document rendering
  are not implemented (QR payloads/receipt codes, stencil previews, and export
  document payloads are); BI export is a JSON download.
- Demo credentials above are shared-password demo logins — rotate and split
  per-role passwords before any client handoff (same rule as Oyaya).
- Signature security: hashed PINs + SHA-256 signature binding (Phase 1);
  full PKI/HSM remains a production-hardening item.
- hms-db free tier expires 2026-11-11 unless upgraded (~$7/mo) — Murago shares
  that instance, so the same decision covers it.
