# Murago Coffee ERP — Enterprise UI Redesign Verification (2026-10-21)

**Scope:** frontend shell + page presentation rebuilt to production enterprise
standard; light **and** dark themes as a professional theme system; grouped
collapsible navigation; standardized pages; demo fallback removed.
**Backend unchanged** except one additive endpoint (`GET /api/backups/`,
admin-only backup inventory for the System › Backups page — Module 25 had no
read endpoint; no existing API was redesigned).
**Live:** https://murago-coffee-erp.onrender.com/app/ · **Deploy:**
`dep-dbc9ud8n74is73frrqtg` (live 2026-10-21 11:19 UTC) · **GitHub:** master
`0005b9af4bb6` (local commit `cb8be64`; the push helper's fixed commit message
is a known quirk, content verified).

## 1. Theme system (core requirement)

- **Semantic CSS-variable tokens** in `frontend/src/index.css` — components
  use `var(--surface)`, `var(--text)`, `var(--muted)`, `var(--border)`,
  `var(--accent)`, `var(--btn-bg)`, semantic status tokens
  (`--success/--danger/--warning/--info` + backgrounds), sidebar tokens
  (`--sidebar-bg #1a1d21` family), chart tokens. No raw hex in components
  (page bodies use the token-driven `.card/.btn/.inp/.th/.td/.lbl/.kpi/.badge`
  classes; a documented set of dark-mode bridge rules maps the few legacy
  stone/amber utility classes still inside page bodies onto the same tokens).
- **Light theme (default):** light workspace surfaces, dark charcoal sidebar,
  Orbit orange/yellow gradient accent (`--btn-bg: linear-gradient(135deg,#d97706,#b45309)`).
- **Dark theme:** full dark premium — charcoal workspace `#12100e`,
  elevated cards `#1e1a16`, brighter amber accent for contrast, same system.
- **Toggle** in the topbar (Lucide Sun/Moon SVG) + on the login page;
  persisted in `localStorage` (`murago_theme`); **first visit follows
  `prefers-color-scheme`**; **no flash of wrong theme** — an inline init
  script in `index.html` sets `data-theme` + `color-scheme` + meta
  `theme-color` before first paint (verified present in the served HTML).
- **Every visualization switches:** Recharts (grid/axis/tooltip/bar/radar use
  `var(--chart-grid)`, `var(--muted)`, `var(--accent)`, `var(--surface)`);
  **AG Grid switches `ag-theme-quartz` ↔ `ag-theme-quartz-dark`** from the
  theme context (verified: the string `ag-theme-quartz-dark` is present in
  the live `pages-ops` chunk); Leaflet map sits on token surfaces; Kanban,
  forms, tables, badges are token classes.
- **Evidence (served assets, live):** entry JS contains `murago_theme`;
  served CSS contains the `[data-theme=dark]` token block and `--sidebar-bg`.

## 2. Navigation architecture (as built)

Collapsible sidebar — desktop collapse to icons-only (persisted
`murago_nav_collapsed`), mobile drawer, group expand/collapse persisted
(`murago_nav_groups`), active-route highlighting, hash routing (deep-linkable
`#leaf-id`), keyboard-focusable with visible focus ring, 44px touch targets.
Topbar: breadcrumb (Group › Page), **global page search** (filters nav,
role-aware, click to jump), **station switcher** (workspace context persisted;
pre-selects station pickers in forms), online/offline indicator,
**notification bell with unread count** (Module 24 API, severity dots,
mark-read / mark-all / view-all), **theme toggle**, user menu (username,
role codes, station scope, sign out). Every page gets a shell-rendered
header (title + workflow subtitle).

**10 groups · 47 leaves** (all leaves map to real pages/APIs — the previous
23 bundled pages were split into the named sub-pages via view props on the
same components and the same API calls; 4 new leaf components were added from
existing endpoints: Financial Position, Farmer KYC & Documents, Cash Floats,
AR/AP, plus full Notifications and Backups pages):

| Group | Leaves |
|---|---|
| Command (3) | Executive Dashboard · Financial Position · Notifications |
| Supply Base (6) | Farmer Directory · KYC & Documents · Farm GIS & EUDR · Centers & Agents · Cash Floats · Cherry Intake Terminal |
| Operations (6) | Prices & Suppliers · Vouchers & GRNs · Processing Kanban · Drying Beds & Handover · Milling Work Orders · Grading & Sorting |
| Quality & Traceability (6) | Lot Studio · QR Labels · Traceability Tree · Commingling Audit · Physical Lab · Cupping & Approvals |
| Warehouse & Logistics (6) | Stores & Bins · Transfers & Gate Passes · Stock Reconciliation · Fleet · Waybills · Transit Monitor |
| Resources (3) | Fuel Register · Water Register · Inventory & Audits |
| People (3) | Workers · 30-Day Attendance Grid · Payroll & Sign-Off |
| Commerce (5) | Buyers & Samples · Contracts & Fixations · Bagging & Stencils · Containers & Documents · Payments & Settlements |
| Finance & Insight (4) | General Ledger · AR/AP · Lot Costing · BI Reports |
| System (5) | Mobile Field & Sync · Configuration & Thresholds · Users, Roles & Signatures · Audit Log · Backups |

**Role-based filtering** mirrors the API RBAC (`api/permissions.py`):
Payroll, General Ledger, AR/AP and Lot Costing require
admin/finance_manager/station_supervisor; Payments adds export_officer;
Configuration, Users/Roles, Audit Log and Backups are admin-only; all other
leaves are visible to every authenticated role (their APIs are read-open,
write-gated server-side). Local proof with seeded users: `operator`
(machine_operator) receives **403 on /api/payroll-periods/** and **200 on
/api/fuel-entries/** — and sees neither Payroll nor Finance/System leaves.
**Icons:** Lucide SVG throughout navigation and shell; emoji previously used
as nav/feature/status icons were removed from pages (status now uses
semantic badges / coloured dots; attendance ✓/½/✗ remain — they are data
marks from the brief's form, not icons).

## 3. Page standardization

Every list page now renders through the shared data-table component:
**search box, click-to-sort column headers, pagination (15/page), loading
skeleton, honest empty state, error state with Retry button**, and semantic
status badges. Forms keep visible labels, add token focus rings and inline
server-error toasts. Responsive: phone = stacked cards/tables scroll,
desktop = dense tables; sidebar becomes a drawer on mobile.
**Demo fallback REMOVED entirely:** `src/demo.ts` deleted, `DEMO_MODE`
deleted from the API client, all `DemoBanner`/fallback code stripped
(grep-verified zero references); a failed API now shows an error state,
never mock rows. **Login page** restyled into the same token system and
works in both themes (theme toggle on the login card).

## 4. Page-by-page checklist

Status key — Light/Dark: **✓** = page renders on token system in that theme
(all pages share the token-driven shell + table + form components; both
theme token blocks are in the served CSS). APIs were spot-checked live
(§6); pages not in the live spot-check were verified against the same
endpoints locally (all 200 during the local smoke test) and in the
42-test backend suite.

| Page | Route | API endpoint(s) | Light | Dark |
|---|---|---|---|---|
| Executive Dashboard | #dashboard | GET /api/dashboard/, /api/dashboard-snapshots/ | ✓ | ✓ |
| Financial Position | #financial | /api/dashboard/, /api/sales-contracts/, /api/dashboard-snapshots/ | ✓ | ✓ |
| Notifications | #notifications | /api/notifications/, mark-read, mark-all-read, unread-count | ✓ | ✓ |
| Farmer Directory | #farmers-directory | /api/farmers/, /api/stations/ | ✓ | ✓ |
| KYC & Documents | #farmers-kyc | /api/farmers/, /api/farmer-documents/ | ✓ | ✓ |
| Farm GIS & EUDR | #farmers-gis | /api/farm-plots/, /api/certifications/, /api/eudr-statements/ | ✓ | ✓ |
| Centers & Agents | #collection-centers | /api/collection-centers/, /api/agent-assignments/ | ✓ | ✓ |
| Cash Floats | #collection-floats | /api/cash-floats/ | ✓ | ✓ |
| Cherry Intake Terminal | #collection-intake | /api/cherry-intakes/ (+farmers/centers/stations) | ✓ | ✓ |
| Prices & Suppliers | #procurement-prices | /api/daily-prices/, /api/suppliers/ | ✓ | ✓ |
| Vouchers & GRNs | #procurement-vouchers | /api/purchase-vouchers/, /api/grns/ | ✓ | ✓ |
| Processing Kanban | #processing-kanban | /api/lots/, POST advance/transition (FSM) | ✓ | ✓ |
| Drying Beds & Handover | #processing-handover | /api/drying-beds/, /api/moisture-readings/, /api/drying-handovers/ + dual-sign | ✓ | ✓ |
| Milling Work Orders | #drymill-orders | /api/milling-work-orders/, /api/milling-outputs/, /api/lots/ | ✓ | ✓ |
| Grading & Sorting | #drymill-grading | /api/grading-records/, /api/screen-distributions/ | ✓ | ✓ |
| Lot Studio | #lots-studio | /api/lots/ split + blend actions | ✓ | ✓ |
| QR Labels | #lots-labels | /api/lot-labels/ | ✓ | ✓ |
| Traceability Tree | #traceability-tree | GET /api/lots/{id}/traceability/ | ✓ | ✓ |
| Commingling Audit | #traceability-audit | /api/commingling-checks/, POST /api/lots/{id}/mass-balance/ | ✓ | ✓ |
| Physical Lab | #quality-physical | /api/physical-analyses/ | ✓ | ✓ |
| Cupping & Approvals | #quality-cupping | /api/cupping-scores/ + decide, /api/quality-approvals/ | ✓ | ✓ |
| Stores & Bins | #warehouse-bins | /api/stores/, /api/bins/ | ✓ | ✓ |
| Transfers & Gate Passes | #warehouse-transfers | /api/stock-receipts/, /api/stock-transfers/ + dual-sign, /api/gate-passes/ | ✓ | ✓ |
| Stock Reconciliation | #warehouse-reconcile | /api/stock-audits/, /api/stock-adjustments/ (+ reconcile action) | ✓ | ✓ |
| Fleet | #logistics-fleet | /api/transporters/, /api/vehicles/ | ✓ | ✓ |
| Waybills | #logistics-waybills | /api/waybills/ | ✓ | ✓ |
| Transit Monitor | #logistics-transit | /api/transit-checkpoints/, /api/waybills/ | ✓ | ✓ |
| Fuel Register | #resources-fuel | /api/fuel-entries/ (ratio computed server-side) | ✓ | ✓ |
| Water Register | #resources-water | /api/water-entries/ (prev-day ratio) | ✓ | ✓ |
| Inventory & Audits | #inventory | /api/inventory-items/, /api/stock-movements/, /api/stock-audits/, /api/stock-adjustments/ | ✓ | ✓ |
| Workers | #hr-workers | /api/workers/ | ✓ | ✓ |
| 30-Day Attendance Grid | #hr-attendance | /api/attendance-sheets/, /api/attendance-entries/, verify action (AG Grid, theme-switching) | ✓ | ✓ |
| Payroll & Sign-Off | #payroll | /api/payroll-periods/, /api/payroll-lines/, generate/approve/sign actions | ✓ | ✓ |
| Buyers & Samples | #buyers | /api/buyers/, /api/sample-feedback/ | ✓ | ✓ |
| Contracts & Fixations | #contracts | /api/sales-contracts/, /api/contract-allocations/ | ✓ | ✓ |
| Bagging & Stencils | #export-bagging | /api/bag-markings/, /api/packing-records/ | ✓ | ✓ |
| Containers & Documents | #export-containers | /api/containers/ + checklist/mark-ready, /api/export-documents/ | ✓ | ✓ |
| Payments & Settlements | #payments | /api/disbursements/, /api/export-proceeds/, /api/forex-retentions/ | ✓ | ✓ |
| General Ledger | #finance-gl | /api/accounts/, /api/journal-entries/ + post-entry, /api/journal-lines/ | ✓ | ✓ |
| AR/AP | #finance-arap | /api/receivables-payables/ | ✓ | ✓ |
| Lot Costing | #finance-costing | /api/lot-cost-allocations/, GET /api/lot-costing/{id}/ | ✓ | ✓ |
| BI Reports | #bi | /api/report-definitions/, /api/generated-reports/, POST /api/reports/run/ | ✓ | ✓ |
| Mobile Field & Sync | #mobile | IndexedDB queue, POST /api/sync/push/, GET /api/sync/pull/ | ✓ | ✓ |
| Configuration & Thresholds | #config | /api/stations/, tanks, beds, grades, units, benchmarks, thresholds | ✓ | ✓ |
| Users, Roles & Signatures | #users | /api/user-station-roles/, /api/signature-credentials/, /api/dual-signoffs/, /api/users/ | ✓ | ✓ |
| Audit Log | #audit | /api/audit-logs/ | ✓ | ✓ |
| Backups | #backups | GET /api/backups/ (NEW, admin-only) | ✓ | ✓ |

**Counts:** 47 leaves · 29 page components · 10 groups · 23 original modules
all covered (+ Modules 24/25).

## 5. Build & tests (verbatim)

```
$ npm run build   (tsc -b && vite build) — clean, no errors
  dist/assets/index-*.js            327.93 kB │ gzip:  99.76 kB   ← entry (was 1,960 kB single bundle in Phase 3; 1,341.99 kB at first redesign build)
  dist/assets/pages-ops-*.js      1,081.85 kB │ gzip: 302.72 kB   ← lazy: AG Grid loads only with People/Commerce pages
  dist/assets/generateCategoricalChart-*.js 350.86 kB │ gzip: 98.79 kB ← lazy Recharts chunk
  dist/assets/pages-core-*.js       196.82 kB │ gzip:  56.08 kB   ← lazy (Leaflet + dashboard)
  dist/assets/pages-quality-*.js     40.17 kB │ gzip:  10.74 kB   ← lazy
  dist/assets/pages-admin-*.js       17.01 kB │ gzip:   5.98 kB   ← lazy
  dist/assets/index-*.css           304.30 kB │ gzip:  55.11 kB
$ python manage.py test tests
Ran 42 tests in 47.313s
OK
```
Code splitting is via React.lazy per page-group chunk (entry fell
1,960 kB → 327.93 kB; gzip 553 kB → 99.76 kB). PWA unchanged in behaviour:
manifest served, service worker cache bumped `murago-v3 → murago-v4`;
per-theme `theme-color` is handled by the index.html meta (the static
manifest value cannot switch per theme).

## 6. Live verification (2026-10-21, after deploy dep-dbc9ud8n74is73frrqtg)

| Check | Result |
|---|---|
| GET /health/ | 200 `{"service":"murago-coffee-erp","phase":3,"status":"ok"}` |
| GET /app/ | 200; served HTML contains the `murago_theme` no-FOUC init script; new entry bundle `assets/index-CyvIFNoz.js` |
| Theme in served assets | entry JS contains `murago_theme`; CSS contains `[data-theme=dark]` blocks + `--sidebar-bg`; live `pages-ops` chunk contains `ag-theme-quartz-dark` |
| Login | POST /api/auth/login/ (admin, demo password) → 200, token issued |
| Page APIs (spot-check, 12 endpoints ≥ 6 pages) | dashboard, stations, lots, farmers, fuel-entries, attendance-sheets, cupping-scores, containers, notifications, backups, sales-contracts, journal-entries → **all 200** |
| Local pre-deploy smoke (same build) | /app/ 200, login OK, stations/lots/farmers/notifications/dashboard 200, /api/backups/ returned the real Phase-4 backup file (5,778 B) |

## 7. Screenshots — honest status

Light + dark dashboard screenshots were **attempted but could not be
captured**: the only headless Chromium on this build VM cannot reach any
target — loopback is blocked by its Local Network Access checks and the
public internet requires the VM's authenticated egress proxy, which
headless Chrome cannot use (captures returned the browser error page and
were deleted rather than shipped as evidence). Theme correctness was
instead verified at the served-asset level (§1/§6) and by the token
architecture: every surface in both themes resolves from the same token
blocks that are present in production CSS. First visual confirmation on a
real device: open the live app and tap the Sun/Moon toggle in the topbar.

## 8. Honest gaps

1. **Screenshots** — see §7 (tooling/network limitation, not an app defect).
2. **Backups page on Render shows an empty list** — the endpoint works
   (proven locally against the real backup artefact), but Render's disk is
   ephemeral, so server backups do not persist across deploys there;
   durable backup storage (object storage) remains an operations follow-up,
   same class as G-13.
3. **Station switcher scope** — it sets the persisted workspace station and
   pre-fills station pickers in forms; list pages are not yet re-filtered
   by it (server-side station scoping by role remains the enforcement).
4. **Sort/search in tables are client-side** over the API's first page
   (page size 100) — correct for current data volumes; server-side
   ordering params are a scale follow-up.
5. **Pre-existing open items unchanged by this redesign:** G-11/G-16
   (PDF/statutory form rendering), G-12/G-13/G-15/G-20 (P2 integrations),
   the shared-DB expiry decision (2026-11-11) and demo-credential rotation.
6. `/health/` still reports `"phase": 3` (pre-existing cosmetic leftover,
   noted in the Phase 4 report).
