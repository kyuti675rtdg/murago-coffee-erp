# Murago Coffee ERP — Gap Analysis Matrix (Phase 4, 2026-10-21)

Audit method: code-level review of the finished Phase 1–3 system (85→87 models,
87 viewsets, 23 SPA pages, engines, deployment) against the original 23-module
brief, page by page. Status key: ✅ implemented+tested · 🟡 implemented, partial
depth · ❌ gap (in register below). Permissions shorthand: AO=Machine Operator,
SS=Station Supervisor, IP=Industry Professional, QG=Q-Grader, DM=Dry Mill Mgr,
EO=Export Officer, FM=Finance Manager, AD=Admin.

## Module → Submodule → Page → Functionality matrix

| # | Module / Submodule / Page | Key fields | Actions | Validations | Approvals | Reports | Permissions (write) | Status |
|---|---|---|---|---|---|---|---|---|
| 1.1 | Executive / Station & Pipeline Telemetry / Live Operations Command Center | lots_by_stage, cherry kg, stock kg, containers, fuel/water avg ratios | view KPIs, stage chart | — | — | dashboard API | all roles read | ✅ live aggregates; `DashboardSnapshot` table also exists (🟡 duplicated source — G-17) |
| 1.2 | Executive / Financial & Position / Executive Financial & Contract Summary | committed kg, open contracts, cash float, landed cost/kg | view snapshots | — | — | snapshot list | all read | ✅ |
| 2.1 | Farmers / Outgrower Registry & KYC / Farmer Directory | farmer_code, name, phone, national ID, family, trees, cap kg | register, list | unique code; cap fields | KYC status field | directory | SS, Purchaser, AD | ✅ (document upload is path-reference only — G-13 family) |
| 2.2 | Farmers / Farm GIS & EUDR / Polygon Map & Document Vault | GeoJSON polygon, elevation, variety, deforestation_free | map render, DDS list | GeoJSON type check | DDS status workflow field | EUDR dossier payload | SS, AD | 🟡 GeoJSON storage by design; native PostGIS columns not runtime (G-10) |
| 3.1 | Collection / Collection Center Operations | center code, altitude, floats allocated/spent/returned | configure, assign agents | unique codes | — | float list | SS, Purchaser, AD | ✅ |
| 3.2 | Collection / Weighbridge & Cherry Intake / Scale Terminal | gross, tare, net, deduction %, payable, price, QR code | record intake, QR receipt code shown | gross ≥ tare; deduction 0–100; net/payable/total computed server-side | — | intake ledger | SS, Purchaser, AD | 🟡 WebSerial scale not integrated (G-12); lot link is manual (G-18) |
| 4.1 | Procurement / Dynamic Pricing & Supplier Contracts | daily price by product/grade/station, supplier registry | set price, manage suppliers | unique supplier code | — | price list | SS, Purchaser, FM, AD | ✅ |
| 4.2 | Procurement / Purchase Vouchers & GRNs / Purchase Ledger | voucher qty/price/total, GRN received/variance | create, **approve/reject (Phase 4 hierarchy)** | totals; status machine | **≤50k SS · ≤500k FM · >500k AD; creator ≠ approver** | voucher/GRN lists | SS, Purchaser, FM, AD | ✅ Phase 4 |
| 5.1 | Processing / Wet & Natural Workflow (FSM) / Kanban & Stage Tracker | lot_code, stage, process type, pulping/laid/washing dates | advance, move-to, transition API | **FSM single-step only; illegal → 400** | dual sign-off fields on events | stage events | SS, IP, DM, AO, AD | ✅ |
| 5.2 | Processing / Drying Bed & Yield Handover / Handover Form | bed no, moisture %, dried kg, storage date, issued/received + PINs | record + dual-sign | moisture 10.5–11.5 warning; two different users; PIN verified | **Issued By ≠ Received By** | handovers, moisture list | SS, IP, AD | ✅ |
| 6.1 | Dry Mill / Milling Work Orders & Hulling / Batch Terminal | input/green/husk/loss kg, tolerance | create WO, record output | mass-balance properties (imbalance, outturn) | — | outputs | DM, IP, AD | ✅ + Phase 4 chain reconciliation |
| 6.2 | Dry Mill / Mechanical Grading & Sorting | screen 14–18 weights, gravity/color/hand-picked | record grading | screen range constraint | — | grading log | DM, IP, AD | ✅ |
| 7.1 | Traceability / Lineage Explorer / Traceability Tree | DAG edges, ratios, ancestors/descendants | view tree, **run mass-balance (Phase 4)** | cycle prevention; ratio sums | — | lineage, **MassBalanceCheck** | SS, IP, DM, AD | ✅ Phase 4 reconciliation added |
| 7.2 | Traceability / Anti-Commingling / Risk & Audit Monitor | separation checks per lot/location | record checks | — | — | checks list | SS, IP, AD | ✅ |
| 8.1 | Lots / Lot Structuring & Lifecycle / Split & Blend Studio | lot codes, weights, ratios | split, blend | over-draw rejected; full-split ratios = 1.0 | — | lineage edges | SS, IP, DM, AD | ✅ |
| 8.2 | Lots / Lot Labeling & QR Tagging / Print Queue | QR payload, net weight, status | queue labels | unique QR payload | — | label list | SS, IP, AD | 🟡 physical printing not implemented (G-13) |
| 9.1 | Quality / Physical Green Analysis / Lab Worksheet | moisture, a_w, density, colour, defects | record analysis | moisture warning flag; non-negative | — | analyses | QG, IP, AD | ✅ |
| 9.2 | Quality / Sensory Cupping & Approval / Scorecard | 10 attributes 0–10, total, grade 1–5/UG | save scorecard, **decide approve/reject** | attribute range 0–10 | QG decision = export release gate | approvals | QG, IP, AD | ✅ radar UI |
| 10.1 | Warehouse / Segregated Store & Bin Topology / Bin Map | store form (parchment/natural/green), bin capacity, certified_only | view map | unique bin per store | — | bin grid | SS, IP, DM, AD | ✅ |
| 10.2 | Warehouse / Stock Receiving, Transfers & Dispatch / Gate Pass Manager | receipt/transfer weights, shrinkage, gate passes | dual-sign receipt/transfer, receive out-turn | two different users on sign-off | **dual sign-off** | transfers, passes | SS, IP, DM, AD | ✅ |
| 11.1 | Resources / Generator & Pulper Fuel / Fuel Register የነዳጅ ፍጆታ መከታተያ ቅጽ | purchased/added litres, pulped kg, ratio, anomaly | create entry → computed ratio | ratio = L ÷ same-day kg; threshold anomaly **+ notification (Phase 4)** | — | register + anomalies | AO, SS, IP, AD | ✅ |
| 11.2 | Resources / Water Meter & Efficiency / Water Register የውሃ ፍጆታ መከታተያ ቅጽ | meter readings, consumption, prev-day kg, ratio, lagoon % | create entry → computed ratio | consumption = reading − previous; ratio uses **previous-day** kg; anomaly **+ notification** | — | register | AO, SS, IP, AD | ✅ |
| 12.1 | HR / Seasonal Worker Registry / Onboarding | worker code ተ.ቁ, kind, wage type/rate | register workers | unique code | — | registry | SS, FM, AO, AD | ✅ |
| 12.2 | HR / 30-Day Time Control Matrix / Attendance Grid የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ | sheet ወር/ዓ.ም, cells day 1–30, marks, hours, pieces | AG-Grid inline edit, save (**upsert — Phase 4 fix**), dual-verify | day 1–30; unique cell; **both signatures, different users, PINs** | **Controlled By + Verified By** | sheets/entries | SS, FM, AO, AD | ✅ |
| 13.1 | Payroll / Seasonal Wage Computation / Payroll Sheet የቀን ሠራተኞች መክፈያ ፔሮል | totals days/hours/pieces, ጠቅላላ ክፍያ, ተቆራጭ, የተጣራ ክፍያ | generate from verified sheet | **blocked without dual verification**; advances = deductions | — | payroll lines | FM, AD | ✅ + Phase 4 notification on generation |
| 13.2 | Payroll / Approval & Recipient Sign-Off | prepared/approved by, recipient signature hash | approve, tablet sign per line | **Prepared ≠ Approved** | **dual approval** | sign-off sheet | FM, AD | 🟡 recipient signature is a hashed attestation string from the UI, not a drawn-signature capture (G-19) |
| 14.1 | Buyers / International Buyer CRM / Directory & Sample Feedback | buyer, consignee, PSS status/feedback | manage buyers, log PSS | — | PSS status field | directory | EO, FM, AD | ✅ |
| 14.2 | Buyers / Export Sales Contracts / Price Fixation Ledger | grade, MT/bags, outright vs ICE diff, incoterm, allocations | create contract, allocate lots | **allocation ≤ contract capacity; locked allocations immutable; closed lots rejected** | signed status | contracts/allocations | EO, FM, AD | ✅ |
| 15.1 | Export / Bag Marking, Labeling & Packing / Stencil Generator | ICO mark, buyer stencil, bag type, packing tallies | create markings/packing, stencil preview | — | — | packing list data | EO, AD | 🟡 stencil is an on-screen preview; print/PDF not implemented (G-11/G-13) |
| 15.2 | Export / Container Stuffing & Clearance / Documentation Suite | container, seal, bags, net kg, 7 doc types | stuff container, create docs, **checklist + mark-ready (Phase 4)** | **ready gate: ICO + phytosanitary + ECTA + invoice + packing list + EUDR dossier all present; seal + load required** | checklist gate | documents list | EO, AD | ✅ gate; 🟡 document files are payloads, not rendered PDFs (G-11) |
| 16.1 | Logistics / Fleet & Transporter Dispatch / Waybill Generator | transporter, vehicle, driver, waybill weights | dispatch waybills | — | — | waybills | EO, SS, AD | ✅ |
| 16.2 | Logistics / Transit & Corridor Tracking / Transit Monitor | checkpoints, verified weights, shrinkage | log checkpoints | shrinkage computed (dispatch − delivered) | — | transit list | EO, SS, AD | ✅ |
| 17.1 | Finance / Multi-Currency GL / CoA, Journals & AR/AP | accounts, journal lines one-side-only, AR/AP balances | create entries/lines, **post journal (Phase 4)** | **debits = credits per currency enforced at MODEL save (POSTED) + API post action; posted lines frozen** | posting = FM/AD act | GL, AR/AP | FM, AD | ✅ Phase 4 |
| 17.2 | Finance / Activity-Based Lot Costing / Landed Cost Analyzer | cost components per lot, landed cost/kg | allocate costs, lookup per lot | — | — | costing API | FM, AD | ✅ |
| 18.1 | Payments / Field, Supplier & Worker Disbursements | payee type, voucher/float/payroll links, method | record disbursements | — | voucher matching by reference | disbursements | FM, EO, AD | 🟡 no bank/cash-float auto-reconciliation engine (G-20 family) |
| 18.2 | Payments / Export Proceeds & Receipts / LC/CAD Reconciliation | SWIFT ref, USD amounts, retention split | record proceeds, retention | retention OneToOne per proceeds | — | proceeds/forex | FM, EO, AD | ✅ |
| 19.1 | Inventory / Non-Coffee Consumables & Spares / Materials Ledger | SKU, category, reorder level, movements | stock movements | — | — | ledger, stock_at | SS, DM, AD | ✅ |
| 19.2 | Inventory / Physical Stock Audits / Reconciliation Worksheet | book vs counted, variance, reason, approver | **reconcile (Phase 4)**: posts ADJUSTMENT movements | **variance lines need approver ≠ conductor + reason; already-reconciled audits locked** | adjustment approval | audits/adjustments | SS, DM, AD | ✅ Phase 4 workflow |
| 20.1 | BI / Operational & Compliance Analytics / Report Builder & Export | report defs, kinds (procurement/yields/efficiency/quality/stock) | run report, download JSON | kind whitelist | — | generated reports | FM, SS, AD | 🟡 JSON export only; statutory PDF/Excel formats missing (G-16) |
| 21.1 | Mobile / Offline Field Data Capture | farmer/plot/intake capture, UUIDv7 | queue offline (IndexedDB) | client UUID required | — | queue list | AO, SS, AD | ✅ |
| 21.2 | Mobile / Station Operator Logs & Sync Engine | fuel/water/handover capture, conflicts | push/pull sync, conflict list | idempotent by client_uuid; stale writes → conflict records | — | sync manager UI | AO, SS, AD | 🟡 domain upsert applies flat fields; nested FK payloads stay queued for review (G-20) |
| 22.1 | Config / Master Data & Site Topology | stations, beds, tanks, grades, units | configure | unique codes | — | config lists | AD | ✅ |
| 22.2 | Config / Conversion & Threshold Rules | benchmarks, moisture band, fuel/water thresholds | configure thresholds | moisture min < max | — | thresholds consumed by calculators + mass-balance defaults | AD | ✅ |
| 23.1 | Users / RBAC & Station Scoping / Role Permission Matrix | 9 roles, station assignments | manage assignments | unique user+role+station | — | matrix UI | AD | ✅ enforced server-side (WRITE_MATRIX + restricted reads) |
| 23.2 | Users / Digital Signatures & Audit Logs | PIN credentials (hashed), signature SHA-256, hash-chained audit | sign-offs, audit view | PIN ≥ 4; audit append-only | — | audit trail | AD | 🟡 no full PKI/HSM (G-15) |
| **24** | **Notifications & Alerts Centre (ADDED Phase 4)** | category, severity, title/body, link, read state | bell + list, mark read/all, unread count | own-notifications-only queryset | — | notification API | all authenticated (own) | ✅ NEW — anomaly (fuel/water/mass-balance), payroll and voucher-approval events wired |
| **25** | **Backup & Data Management (ADDED Phase 4)** | backup files (pg_dump SQL.gz or dumpdata JSON.gz) | `manage.py backup_db` | output JSON validated parseable; pg password via env only | — | backup log line | AD (ops) | ✅ command run-proven locally (5,778 B seed backup; test-run in suite) |
| 26 | Integration / API Monitoring (mapped, not duplicated) | OpenAPI schema, health, sync queue/conflicts | `/api/schema/`, `/api/docs/`, `/health/`, sync manager | — | — | — | — | 🟡 internal monitoring exists; **no external integrations** (AfroMessage SMS, ZKTeco, WebSerial) — G-12/G-20, P2 |
| 27 | Regulatory Reporting — ECTA / EUDR (mapped, not duplicated) | DDS records (2.2), export doc payloads (15.2), BI kinds (20.1) | generate DDS/doc payloads, run BI reports | EUDR dossier required by container gate | — | — | — | 🟡 payload-level compliance complete; **official statutory PDF/form layouts not rendered** — G-16, P1 open |

## Dependency / business-flow map

```
Farmer(2) + Plot GIS/EUDR(2.2) ─► Collection Center(3.1) ─► Cherry Intake(3.2, mass-in)
   │                                                              │ lot link
   ├─► Daily Prices(4.1) ─► Purchase Vouchers(4.2, hierarchy) ─► GRN ─► Payments(18.1)
   ▼                                                              ▼
Lot FSM(5.1) ─► Drying+Handover dual-sign(5.2) ─► Dry Mill(6, outturn) ─► Quality(9, QG gate)
   │ DAG split/blend(8.1)        │                        │
   ▼                             ▼                        ▼
Traceability(7.1) ◄── Mass-Balance(Phase 4) ──► Notifications(24) on critical variance
Warehouse bins/receipts/transfers dual-sign(10) ─► Stock Audits/Reconcile(19.2)
Fuel/Water registers(11) ──► anomaly ──► Notifications(24); costs ──► Lot Costing(17.2)
Workers(12.1) ─► Attendance grid dual-verify(12.2) ─► Payroll(13, Prepared≠Approved) ─► Payments(18.1)
Buyers/PSS(14.1) ─► Contracts + allocation locks(14.2) ─► Bagging/Stencil(15.1)
   ─► Container + Doc Checklist gate(15.2) ─► Logistics waybills/transit(16)
   ─► Export Proceeds LC/CAD + Forex(18.2) ─► Journals AR/AP(17.1, balanced-posting) 
Sync(21) underpins all field capture; Config(22) thresholds/benchmarks feed
calculators(11), mass-balance(7.1) and moisture gates(5.2/9.1); RBAC(23) scopes
every API queryset by station; Audit(23.2) records API writes + sign-offs.
Backup(25) snapshots the whole graph (logical DB `murago` on shared hms-db).
```

## Gap register (classified, prioritised)

| ID | Gap | Class | Priority | Phase 4 disposition |
|---|---|---|---|---|
| G-01 | No end-to-end mass-balance reconciliation (intake→export quantities disconnected) | Disconnected | **P0** | ✅ IMPLEMENTED: `traceability/mass_balance.py` + `MassBalanceCheck` + `POST/GET /api/lots/{id}/mass-balance/` + UI runner + critical notifications; E2E-asserted |
| G-02 | Journal balance was a display property only; unbalanced journals could be marked posted | Incorrect | **P0** | ✅ IMPLEMENTED: model-level save block on POSTED + `post-entry` API action + posted-line freeze; tests |
| G-03 | Containers could be sealed with no export documents present | Missing | **P0** | ✅ IMPLEMENTED: `exports/checklist.py` (6 required docs) + `checklist`/`mark-ready` endpoints + UI gate; E2E-asserted |
| G-04 | Stock audits existed but no reconciliation workflow (variances never posted to ledger) | Incomplete | **P0** | ✅ IMPLEMENTED: `inventory/reconcile.py` + endpoint; approver ≠ conductor + reason required; ADJUSTMENT movements posted; tests |
| G-05 | No notifications/alerts anywhere (anomalies invisible until someone opened a register) | Missing | **P0** | ✅ IMPLEMENTED: Module 24 — `core.Notification`, notify helpers, API + bell UI; wired to fuel/water anomalies, mass-balance critical, payroll generation, voucher approval |
| G-06 | Voucher approval was a free-form status (no amount hierarchy, creator could approve own) | Incomplete | P1 | ✅ IMPLEMENTED: `procurement/approvals.py` (≤50k SS, ≤500k FM, >500k AD, creator ≠ approver) + endpoints; tests |
| G-07 | No backup procedure or artefact | Missing | P1 | ✅ IMPLEMENTED: `backup_db` command (pg_dump or dumpdata JSON), run-proven locally + in test suite; restore = loaddata/pg restore (documented in readiness report) |
| G-08 | Production hardening defaults absent (secure cookies/HSTS/SSL redirect) | Incomplete | P1 | ✅ IMPLEMENTED behind `MURAGO_HARDEN=1` env (set on Render); DEBUG already env-off in prod |
| G-09 | Attendance grid re-save failed on the unique cell constraint (operator-hostile) | Incorrect | P1 | ✅ FIXED: attendance-entry create is now an upsert by (sheet, worker, day); test added |
| G-10 | GIS field/engine mismatch crashed first deploy (farmers import vs settings detection) | Incorrect | P1 | ✅ FIXED in Phase 3 (single-source `settings.GIS_AVAILABLE`); production pinned to GeoJSON mode |
| G-11 | Export documents, invoices, payroll sheets have no rendered PDF/print output | Missing | P1 | ❌ OPEN — payloads + stencil preview exist; PDF rendering (e.g. WeasyPrint) is the top remaining build item |
| G-16 | ECTA/EUDR statutory report *formats* not produced (data + dossiers exist as payloads) | Incomplete | P1 | ❌ OPEN — depends on G-11 rendering; BI export is JSON today |
| G-12 | WebSerial digital-scale capture not integrated (manual entry only) | Missing | P2 | ❌ OPEN — browser hardware API; field is modelled (`weight_source`) |
| G-13 | QR/barcode label + receipt printing not implemented (payloads/codes only); KYC document files are path references, no object storage | Incomplete | P2 | ❌ OPEN |
| G-15 | Signatures use hashed PIN + SHA-256 binding, no PKI/HSM, no drawn-signature capture (also payroll recipient column, G-19) | Incomplete | P2 | ❌ OPEN — production-hardening item |
| G-17 | Dashboard KPIs computed live AND persisted as `DashboardSnapshot` (two sources of truth) | Duplicated | P2 | ❌ OPEN — decide: snapshots as scheduled history only (recommended), live API stays primary |
| G-18 | Cherry intake → lot link is manual; intake does not auto-create/attach a lot | Disconnected | P2 | ❌ OPEN — mass-balance tolerates unlinked intakes (segment skipped); auto-link by station+date+variety is a small follow-up |
| G-20 | Sync domain upsert handles flat fields only; no external integrations (SMS/ZKTeco/bank) or auto float reconciliation | Incomplete | P2 | ❌ OPEN — conflicts surface safely in the Sync Manager instead of corrupting data |
| G-21 | Shared `hms-db` free tier **expires 2026-11-11** unless upgraded (~$7/mo) — affects HMS, Orbit and Murago | Missing (operational) | **P0 operational** | ⚠ NOT a code gap: owner decision required; recorded as a production blocker in the readiness report |
| G-22 | Demo users share one documented password | Incorrect (operational) | P1 operational | ⚠ Rotate + per-role passwords before any client data enters the system |

**Counts: 22 gaps — P0: 6 (5 code gaps implemented in Phase 4 + 1 operational blocker), P1: 8 (6 implemented/fixed + G-11/G-16 open + 1 operational), P2: 6 open.** Additional modules beyond the 23: **2 added** (24 Notifications, 25 Backup & Data Management); 2 assessed and mapped onto existing modules instead of duplicating (26 Integration/API Monitoring → sync + schema + health; 27 Regulatory Reporting → BI + exports + DDS).
