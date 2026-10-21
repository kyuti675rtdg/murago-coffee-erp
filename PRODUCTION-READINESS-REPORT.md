# Murago Coffee ERP — Production Readiness Report (Phase 4, 2026-10-21)

**System:** Murago Coffee ERP (Bean Power ERP) — Django 5.2 + DRF + React PWA,
one Render service serving API + SPA.
**Live:** https://murago-coffee-erp.onrender.com (`/app/`, `/api/`, `/health/`,
`/api/schema/`) · **Repo:** https://github.com/kyuti675rtdg/murago-coffee-erp
(public, master) · **Service:** `srv-dbc9aa61egvs739u4840` (free, Frankfurt) ·
**DB:** logical database `murago` on shared `hms-db` Postgres 16 + PostGIS 3.6.
**Verdict:** functionally complete against the 23-module brief + 2 added modules,
verified locally (42/42 tests) and live. **Not yet cleared for real client data**
until the two operational blockers in §5 are resolved (DB expiry decision +
credential rotation). No completion claim below is made without evidence.

## 1. Completed features (with evidence)

| Area | Evidence |
|---|---|
| Phase 1 schema + engines | 87 models / 21+2 apps; `VERIFICATION.md`; 17 engine tests |
| Phase 2 API | 87 viewsets, 13+ engine action endpoints, Token auth, RBAC matrix, station scoping, audit-on-write, sync push/pull, OpenAPI schema — `PHASE2-3-VERIFICATION.md`; 12 API tests |
| Phase 3 frontend | 23 module pages (brief order) + Phase 4 additions (notification bell, mass-balance runner, container readiness, journal post controls); Vite build OK (JS 1,960 kB / gzip 553 kB); PWA manifest + service worker + IndexedDB offline queue; AG Grid attendance, Leaflet polygons, Recharts radar/bars |
| **Mass-balance enforcement (P0)** | `traceability/mass_balance.py` + `MassBalanceCheck`: intake→cherry→parchment→green→bagged→exported segments vs benchmark-expected outputs, statuses ok/warning/critical persisted, critical → notifications. Live proof: lot `MUR-LIVE-P4-001` cherry→parchment variance −2.50% → `ok`, check row persisted |
| **Journal balance enforcement (P0)** | Model-level: a journal cannot be saved POSTED unless debits = credits per currency; API `post-entry` returns the per-currency imbalance on failure; posted journals' lines are frozen. Tests: model ValidationError, endpoint 400/200, line-freeze 400 |
| **Export document gate (P0)** | `exports/checklist.py`: ICO, phytosanitary, ECTA, commercial invoice, packing list, EUDR dossier all required + seal + load before `mark-ready` seals a container. Live proof: checklist on `LIVE-P4-001` lists all missing; `mark-ready` → **400** |
| **Stock reconciliation (P0)** | `inventory/reconcile.py`: variance lines require approver ≠ audit conductor + variance reason; reconciling posts ADJUSTMENT stock movements and locks the audit. Tests incl. stock_at −5 after reconcile |
| **Notifications centre (P0, new Module 24)** | `core.Notification` + API (own-only queryset, unread-count, mark read/all) + frontend bell with severity icons and deep links. Wired events: fuel/water ratio anomalies, mass-balance critical, payroll generation, voucher approval. Live proof: `/api/notifications/unread-count/` → 200 |
| **Approval hierarchy (P1)** | Purchase vouchers: ≤50k ETB Station Supervisor, ≤500k Finance Manager, >500k Admin; creator ≠ approver. Tests: 403 above level, 403 self-approval, 200 at correct levels |
| **Backup & data mgmt (P1, new Module 25)** | `manage.py backup_db` → pg_dump `.sql.gz` when available, else validated dumpdata `.json.gz`. Proven: local run produced `backups/murago-backup-20261021T104921Z.json.gz` (5,778 B) + test-suite run. **Restore:** `gunzip` then `psql < file` (SQL) or `python manage.py loaddata <file.json>` (JSON) |
| **Hardening (P1)** | `MURAGO_HARDEN=1` in production: SSL redirect, secure session/CSRF cookies, HSTS 1y + subdomains + preload, proxy SSL header, DENY framing, nosniff; `DJANGO_DEBUG=0`; generated `DJANGO_SECRET_KEY` set via Render env API (never in repo/chat) |
| **Attendance upsert fix (P1)** | Grid re-save no longer fails on the unique cell constraint — create upserts by (sheet, worker, day); regression test added |
| E2E chain test | `tests/test_e2e.py`: farmer+plot → intake (1000 kg net/payable, 80,000 ETB) → lot → FSM (illegal skip 400 mid-chain; pulping/washing dates) → milling 200→170+28+2 → cupping total 89.50 → Grade 1 approval → warehouse dual-signed receipt → contract allocation 170/170 kg locked + over-allocation 400 → bag marking/packing/storing → packing 169.50 kg → container checklist gate (EUDR missing named) → sealed → mass-balance all segments `ok` → split ratio 0.4100 genealogy → balanced journal 918.00 USD posted (170 kg × $5.40) → LC proceeds + forex retention 275.40 USD |
| Deployment | GitHub push (198 tracked files) → Render deploy `dep-dbc9d1o473hc73fhhe50` (Phase 2/3) and `dep-dbc9km8ae00c7392ag70` (**Phase 4, live 2026-10-21 10:58 UTC**); keep-alive cron `murago-keepalive` every 10 min |
| PostGIS (Phase-1 gap closed) | Live `GET /api/postgis/` → `{"postgis": true, "postgis_version": "3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1", "geometry_smoke": "POINT(38.4167 6.6)"}` |

## 2. Test results (verbatim)

```
$ python manage.py check   → System check identified no issues (0 silenced).
$ python manage.py test tests
Ran 42 tests in 47.494s
OK
```
Breakdown: 17 Phase-1 engine + 12 Phase-2 API + 12 Phase-4 (journal×2,
voucher×3, reconcile×2, checklist×1, mass-balance/notification×2, attendance
upsert×1, backup×1) + 1 E2E full-chain. **Failed tests: none.**
Live re-verification after Phase 4 deploy (2026-10-21 ~13:58 EAT): health 200
`{"phase": 3, "status": "ok"}` · `/app/` 200 · login 200 (token issued) ·
notifications endpoint 200 · PostGIS probe OK · live demo chain: farmer +
lot created, illegal FSM skip → 400, legal transition → 200, mass-balance
persisted (`ok`), container checklist gate → 400 without documents.

## 3. Unresolved defects

None known in tested behaviour. One *cosmetic* leftover: `/health/` still
reports `"phase": 3` (string not bumped to 4) — harmless, noted for honesty.
The first-deploy GIS crash and the Render env-var persistence failure
(Phase 2/3) were fixed and are documented in `PHASE2-3-VERIFICATION.md`.

## 4. Under-development components (open gaps, from GAP-ANALYSIS-MATRIX.md)

| ID | Item | Priority |
|---|---|---|
| G-11 | PDF/print rendering for export documents, commercial invoices, payroll sheets, bag stencils | P1 — top remaining build item |
| G-16 | ECTA/EUDR statutory report *formats* (data, dossiers and checklist gate are complete; official PDF layouts are not) | P1 |
| G-12 | WebSerial digital-scale integration (manual entry + `weight_source` field today) | P2 |
| G-13 | QR/barcode physical printing; KYC document object storage (path references today) | P2 |
| G-15/G-19 | Full PKI/HSM signatures; drawn-signature capture incl. payroll recipient column (hashed PIN + SHA-256 attestation today) | P2 |
| G-17 | DashboardSnapshot vs live KPI duplication — recommend snapshots become scheduled history only | P2 |
| G-18 | Intake → lot auto-linking (manual link today; mass-balance skips unlinked intakes) | P2 |
| G-20 | Sync upsert handles flat fields only (nested payloads queue safely for review); no external integrations (SMS/ZKTeco/bank feeds) | P2 |
| — | JS bundle is one 1.96 MB chunk (gzip 553 kB) — code-splitting is a performance follow-up | P2 |

Gap counts (full register: `GAP-ANALYSIS-MATRIX.md`): **22 gaps — P0: 6**
(5 code gaps implemented in Phase 4; 1 operational blocker below), **P1: 8**
(6 implemented/fixed; G-11 + G-16 open; 1 operational), **P2: 6 open**.
Modules added beyond the brief's 23: **24 Notifications & Alerts Centre** and
**25 Backup & Data Management** (both implemented). Integration/API Monitoring
and ECTA/EUDR Regulatory Reporting were assessed and mapped onto existing
modules (sync + schema + health; BI + exports + DDS) rather than duplicated.

## 5. Production blockers (operational, not code)

1. **Database expiry (P0):** the shared `hms-db` free Postgres **expires
   2026-11-11** unless upgraded (~$7/mo). It hosts HMS, Orbit ERP and Murago.
   Decision + payment are the owner's; without it all three systems lose
   their database. A new free DB is impossible (Render: "cannot have more
   than one active free tier database" — verified).
2. **Demo credentials (P1):** seeded users share the documented demo password
   `MuragoAdmin2026!` with PIN `1234`. Rotate to per-role passwords and PINs
   before any real client data is entered (same rule applied to Oyaya).
3. **Free-tier sleep:** the web service sleeps after ~15 min idle; the
   10-min keep-alive cron mitigates this, but a paid instance removes
   cold starts entirely.
4. **GIS mode:** production runs GeoJSON geometry storage (`MURAGO_USE_GIS=0`)
   with PostGIS 3.6 enabled and verified. Native geometry columns (DDL in
   `sql/phase1_schema.sql`) require a migration + GDAL-standard image — a
   deliberate, documented trade-off, not a defect.

## 6. Demo access (DEMO ONLY)

https://murago-coffee-erp.onrender.com/app/ — users `admin`, `supervisor`,
`operator`, `qgrader`, `finance`, password `MuragoAdmin2026!`, signature PIN
`1234`. Seeded explorable data: Murago station, 2 farmers + plot, intakes,
a lot at Drying + one walked to Pulping, fuel/water entries with computed
ratios, dual-verified attendance sheet (2/2018), Hamburg buyer + contract,
plus the Phase-4 live-check records (`FRM-LIVE-P4`, `MUR-LIVE-P4-001`,
container `LIVE-P4-001`).
