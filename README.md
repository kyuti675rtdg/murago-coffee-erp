# Murago Coffee ERP (Bean Power ERP) — Phase 1

End-to-end farm-to-export coffee processing, traceability and ERP system for
Ethiopian washing stations, dry mills and export operations.
**Phase 1 = database & core domain architecture** (this repo). APIs are Phase 2,
frontend Phase 3 — see `VERIFICATION.md` for the honest status per module.

## Stack decision

| Layer | Decision |
|---|---|
| Backend | **Django 5.2 + Django REST Framework** (Python), Service-style domain engines in plain modules (`processing/fsm.py`, `traceability/dag.py`, `resources/calculators.py`, `hr_payroll/engine.py`, `core/signoff.py`) |
| Database | **PostgreSQL + PostGIS via GeoDjango** in production (`DATABASE_URL=postgis://…`) |
| Local fallback | SQLite **only** for local check/test when `DATABASE_URL` is unset. Documented, never a production target. |
| GIS locally | GDAL/GEOS native libraries were **not available** on the build machine (apt install blocked by broken package deps), so locally `FarmPlot.boundary/centroid` fall back to GeoJSON `JSONField` storage. The same model code uses real GeoDjango `PolygonField`/`PointField` (SRID 4326) whenever GDAL is present, and `sql/phase1_schema.sql` carries the production `geometry(Polygon,4326)` DDL + GiST indexes. |
| IDs | **UUIDv7** primary keys everywhere (`core/ids.py`, RFC 9562) — time-ordered, offline-safe for field devices (Module 21 sync). |
| Frontend / Mobile | Phase 3 (React/Vite) and Phase 2/3 offline PWA — schema + sync models are Phase-1 ready. |

Django was chosen over Laravel for this codebase because Orbit's existing
platforms are Django, GeoDjango/PostGIS is first-class, and the domain engines
(FSM, DAG, payroll) are unit-tested in Python here.

## Setup & run

```bash
cp .env.example .env            # set DATABASE_URL=postgis://user:pass@host:5432/murago for production
./start.sh                      # creates .venv, installs requirements, migrates, serves 127.0.0.1:8910
# or manually:
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8910
curl http://127.0.0.1:8910/health/
python manage.py test tests     # 17 engine tests
python scripts/count_models.py  # 85 models across 21 apps
python scripts/dump_schema_sql.py   # regenerates sql/phase1_schema.sql
```

## Architecture

- **Apps = modules.** 21 Django apps map onto the brief's 23 modules (map below).
  Every model has a UUIDv7 PK, `created_at/updated_at`, `created_by/updated_by`,
  and station scoping where the brief requires it.
- **FSM (Module 5):** `processing/fsm.py` — stages advance exactly one step in
  the brief's exact order; illegal skips raise `InvalidTransition`, write no
  event, and are *also* blocked in Postgres by the trigger in
  `sql/phase1_schema.sql`. Every legal move writes an immutable `LotStageEvent`.
- **DAG traceability (Modules 7–8):** `traceability/dag.py` — `split_lot()` /
  `blend_lots()` write `LotLineageEdge` rows with weight ratios (full-split
  ratios sum to 1.0), over-draw rejected, cycles prevented by reachability walk.
- **Dual sign-offs (brief §2.3):** `core/signoff.py` — two *different* users,
  PIN verified against hashed `SignatureCredential`, persisted as immutable
  `core.DualSignOff`; DB `CheckConstraint`s back this up on handovers/receipts/payroll.
- **Efficiency engines (Module 11):** `resources/calculators.py` —
  fuel = litres ÷ kg pulped *that day*; water = litres ÷ **previous day's** kg
  pulped; cherry→parchment→green outturns; anomaly flags vs `sysconf.ThresholdConfig`.
- **Attendance → Payroll (Modules 12–13):** `hr_payroll/engine.py` — a payroll
  run is generated only from a 30-day Ethiopian-calendar attendance sheet
  carrying **both** Controlled By and Verified By signatures (different users);
  gross by wage type (daily/half-day, hourly, piece), deductions = advances,
  approval requires Prepared By ≠ Approved By.
- **Audit:** `core.AuditLog` is append-only with a SHA-256 hash chain.

## Module map (brief → implementation)

| # | Brief module | App(s) | Key models |
|---|---|---|---|
| 1 | Executive Dashboard | `core`, `bi` | DashboardSnapshot, ReportDefinition |
| 2 | Farmer Management | `farmers` | Farmer, FarmerDocument, FarmPlot (GIS), Certification, EUDRDueDiligenceStatement |
| 3 | Coffee Collection | `collection` | CollectionCenter, AgentAssignment, CashFloat, CherryIntake |
| 4 | Procurement | `procurement` | Supplier, DailyPrice, PurchaseVoucher, GoodsReceivedNote |
| 5 | Processing (FSM) | `processing` | Lot, LotStageEvent, DryingBed, BedAssignment, MoistureReading, DryingHandover, LotLabel |
| 6 | Dry Mill | `drymill` | MillingWorkOrder, MillingOutput, GradingRecord, ScreenDistribution |
| 7 | Traceability | `traceability` | LotLineageEdge, ComminglingCheck |
| 8 | Lot & Batch | `processing` + `traceability` | Lot, LotLabel, LotLineageEdge |
| 9 | Quality | `quality` | PhysicalAnalysis, CuppingScore, QualityApproval |
| 10 | Warehouse | `warehouse` | Store, Bin, StockReceipt, StockTransfer, GatePass, StockLedgerEntry |
| 11 | Resource & Utility | `resources` | FuelRegisterEntry, WaterRegisterEntry |
| 12 | HR & Attendance | `hr` | Worker, AttendanceSheet, AttendanceEntry, WorkerAdvance |
| 13 | Payroll | `payroll` | PayrollPeriod, PayrollLine |
| 14 | Buyer & Contract | `buyers` | Buyer, SampleFeedback, SalesContract, ContractLotAllocation |
| 15 | Export | `exports` | BagMarking, PackingRecord, ContainerLoading, ContainerLot, ExportDocument |
| 16 | Logistics | `logistics` | Transporter, Vehicle, Waybill, TransitCheckpoint |
| 17 | Finance & Accounting | `finance` | Account, JournalEntry, JournalLine, ReceivablePayable, LotCostAllocation |
| 18 | Payment | `payments` | Disbursement, ExportProceeds, ForexRetention |
| 19 | Inventory | `inventory` | InventoryItem, StockMovement, StockAudit, StockAdjustment |
| 20 | BI Reports | `bi` | ReportDefinition, GeneratedReport |
| 21 | Mobile Field App | `sync` | SyncQueueItem (UUIDv7 client IDs), SyncConflict |
| 22 | System Configuration | `sysconf` | GradeDefinition, MeasurementUnit, FermentationTank, YieldBenchmark, ThresholdConfig |
| 23 | User & Role Management | `core` | Role, UserStationRole, SignatureCredential, DualSignOff, AuditLog |

> Note: the config app is named `sysconf`, not `sysconfig` — a top-level
> `sysconfig` package shadows Python's stdlib `sysconfig` module and breaks Django.

## Phase 1 deliverables

- 85 models / 85 domain tables (`sql/phase1_schema.sql`, 94 real tables incl. Django built-ins)
- Real, tested engines: FSM, DAG, fuel/water/yield calculators, attendance→payroll, dual sign-off
- 17 passing tests (`tests/test_engines.py`) — see `VERIFICATION.md`
