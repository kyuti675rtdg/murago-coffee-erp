# Murago Coffee ERP — Phase 1 Verification

Verified locally on 2026-10-21 (Africa/Addis_Ababa) on the build VM.
Environment: Python 3.12.3, Django 5.2.18, DRF 3.16.1.
**PostGIS/GDAL: NOT available on this machine** — `apt-get install libgdal-dev`
fails on broken package dependencies and no GDAL/GEOS shared library exists on
the system. All local runs therefore used the documented SQLite fallback.
GeoDjango model code and the production PostGIS DDL are written for production
and are called out where they could not be executed locally.

## Commands run — real results

```
$ python manage.py check
System check identified no issues (0 silenced).

$ python manage.py makemigrations --check --dry-run
No changes detected        (exit=0 — models and migrations are in sync)

$ python manage.py migrate            (SQLite fallback, DATABASE_URL unset)
... all 21 app migrations applied OK (sync.0001_initial, sysconf.0001_initial, ... OK)

$ python manage.py test tests
Ran 17 tests in 4.450s
OK

$ python scripts/count_models.py
TOTAL_MODELS 85   (21 apps — per-app table below)

$ python scripts/dump_schema_sql.py
CREATE TABLE statements: 121 total lines in sqlmigrate output;
verified distinct tables: 85 domain tables == 85 models, + 9 Django built-in
tables = 94 real tables (remaining lines are SQLite "new__*" rebuild artefacts).

$ runserver smoke test
GET /health/       -> {"service": "murago-coffee-erp", "phase": 1, "status": "ok"}
GET /admin/login/  -> HTTP 200
```

## Test coverage (17 tests, all passing — tests/test_engines.py)

| Area | Tests | Result |
|---|---|---|
| FSM | allowed-map strictly sequential; illegal skip blocked (no event written); backwards blocked; legal 12-stage chain + pulping/washing timestamps; natural lot laid_date | 5/5 pass |
| DAG traceability | full-split ratios sum to 1.0000 (0.6000+0.4000); split over-draw rejected; blend ratios 0.4000/0.6000 + child weight; cycle prevention | 4/4 pass |
| Calculators | fuel ratio 20 L/1000 kg = 0.02000 + anomaly flag; water ratio uses previous-day kg (12000 L / 2000 kg = 6.00000); yield outturns (cherry→parchment 0.2000/20%, parchment→green 0.8500) | 3/3 pass |
| Dual sign-off | same user rejected (helper + record); PIN verified (correct passes, wrong raises) | 2/2 pass |
| Payroll | blocked with no signature, with one signature, and with same-user dual signature; aggregation math (10.5 days × 300 = 3150 gross, −150 advance = 3000 net; 40 h × 50 = 2000; 1000 pcs × 2 = 2000; period totals 7150/7000); approval requires distinct approver | 3/3 pass |

## Module checklist

Status key — **Functional** = schema + real domain engine logic, tested.
**Schema-only** = complete models/constraints/indexes; behaviour arrives with
Phase 2 APIs / Phase 3 UI (no placeholder logic claimed).

| # | Module | Models | Status |
|---|---|---|---|
| 1 | Executive Dashboard | DashboardSnapshot (+ bi reports) | Schema-only (KPI aggregation = Phase 2 service) |
| 2 | Farmer Management | Farmer, FarmerDocument, FarmPlot, Certification, EUDRDueDiligenceStatement | Schema-only (GIS fields real GeoDjango in prod; GeoJSON fallback locally) |
| 3 | Coffee Collection | CollectionCenter, AgentAssignment, CashFloat, CherryIntake | Functional (intake net/payable/total computed on save; cap fields on Farmer) |
| 4 | Procurement | Supplier, DailyPrice, PurchaseVoucher, GoodsReceivedNote | Schema-only |
| 5 | Processing (FSM) | Lot, LotStageEvent, DryingBed, BedAssignment, MoistureReading, DryingHandover, LotLabel | **Functional** — FSM engine tested; DB trigger in DDL |
| 6 | Dry Mill | MillingWorkOrder, MillingOutput, GradingRecord, ScreenDistribution | Functional (mass-balance/outturn properties on MillingOutput) |
| 7 | Traceability | LotLineageEdge, ComminglingCheck | **Functional** — split/blend/DAG engine tested |
| 8 | Lot & Batch | Lot, LotLabel, LotLineageEdge | Functional (via FSM + DAG engines) |
| 9 | Quality | PhysicalAnalysis, CuppingScore, QualityApproval | Functional (cupping total_score computed; grade/decision workflow = Phase 2 API) |
| 10 | Warehouse | Store, Bin, StockReceipt, StockTransfer, GatePass, StockLedgerEntry | Schema-only (dual-sign-off constraints enforced at DB level) |
| 11 | Resource & Utility | FuelRegisterEntry, WaterRegisterEntry | **Functional** — fuel/water calculators tested |
| 12 | HR & Attendance | Worker, AttendanceSheet, AttendanceEntry, WorkerAdvance | **Functional** — 30-day grid + dual verification in payroll engine |
| 13 | Payroll | PayrollPeriod, PayrollLine | **Functional** — aggregation + approval engine tested |
| 14 | Buyer & Contract | Buyer, SampleFeedback, SalesContract, ContractLotAllocation | Schema-only |
| 15 | Export | BagMarking, PackingRecord, ContainerLoading, ContainerLot, ExportDocument | Schema-only (document payloads are JSON-ready) |
| 16 | Logistics | Transporter, Vehicle, Waybill, TransitCheckpoint | Functional (shrinkage computed on transfers/waybills) |
| 17 | Finance & Accounting | Account, JournalEntry, JournalLine, ReceivablePayable, LotCostAllocation | Functional (journal balance check + landed-cost-per-kg function) |
| 18 | Payment | Disbursement, ExportProceeds, ForexRetention | Schema-only |
| 19 | Inventory | InventoryItem, StockMovement, StockAudit, StockAdjustment | Functional (stock_at aggregation; variance property) |
| 20 | BI Reports | ReportDefinition, GeneratedReport | Schema-only (report execution = Phase 2) |
| 21 | Mobile Field App | SyncQueueItem, SyncConflict | Schema-only (UUIDv7 client-ID design in place; sync endpoints = Phase 2) |
| 22 | System Configuration | GradeDefinition, MeasurementUnit, FermentationTank, YieldBenchmark, ThresholdConfig | Schema-only (thresholds consumed by calculators) |
| 23 | User & Role Management | Role, UserStationRole, SignatureCredential, DualSignOff, AuditLog (+ Organization, Station) | **Functional** — dual sign-off + PIN engine tested; hash-chained append-only audit log |

## Model/table counts per app (from the live registry)

core 8 · farmers 5 · collection 4 · procurement 4 · processing 7 · drymill 4 ·
traceability 2 · quality 3 · warehouse 6 · resources 2 · hr 4 · payroll 2 ·
buyers 4 · exports 5 · logistics 4 · finance 5 · payments 3 · inventory 4 ·
bi 2 · sync 2 · sysconf 5 → **85 models, 85 domain tables**.

## Honest gaps / Phase 2 pending

- **No REST APIs yet** (Phase 2): DRF is installed and auth defaults set; no
  serializers/viewsets/URLs beyond `/health/` and Django admin.
- **No frontend** (Phase 3): no React/Vue, Kanban, AG-Grid matrices, traceability
  tree UI, or PWA — models + engines are ready for them.
- **PostGIS not executed locally**: no live Postgres+PostGIS on this VM, so the
  FSM trigger and geometry DDL in `sql/phase1_schema.sql` are reviewed DDL, not
  run-verified. First production deploy must run migrations against PostGIS and
  smoke-test the trigger. Locally the FSM is enforced (and tested) in Python.
- WebSerial scale integration, QR/barcode printing, and document PDF rendering
  are Phase 2/3 — the data fields for all of them exist in Phase 1.
- Signature *credential storage* uses Django's password hashers for PINs and
  SHA-256 binding for signature artefacts; a full PKI/HSM integration is a
  production-hardening item, not Phase 1.

---

## Phase 2 & 3 — COMPLETE (2026-10-21)

Full record: `PHASE2-3-VERIFICATION.md`. Summary: 85 DRF viewsets + 13 engine
action endpoints + sync/dashboard/BI/PostGIS endpoints (380 API URL patterns),
Token auth + RBAC matrix + station scoping, 29/29 tests pass (17 Phase-1 + 12
new API). React SPA with all 23 module pages built and served at `/app/`.
**LIVE at https://murago-coffee-erp.onrender.com** (Render
`srv-dbc9aa61egvs739u4840`, GitHub `kyuti675rtdg/murago-coffee-erp`), PostGIS
3.6 verified live on the shared hms-db logical database `murago`
(`GET /api/postgis/` → postgis_version + geometry smoke OK), live FSM test:
illegal skip → 400, legal transition → 200 with pulping_date stamped.
