import {
  LayoutDashboard, Landmark, Bell, Users, Map, FileCheck, Warehouse, Coins, ClipboardList,
  KanbanSquare, Handshake, Cog, FlaskConical, Scale, GitBranch, ShieldCheck, CupSoda,
  Boxes, Truck, Route, Fuel, Droplets, PackageSearch, UserCog, CalendarDays, Wallet,
  Building2, FileSignature, Package, Container, CreditCard, BookOpen, ReceiptText,
  PiggyBank, BarChart3, Smartphone, Settings, KeyRound, ScrollText, DatabaseBackup,
  Sprout, ShoppingCart, type LucideIcon,
} from 'lucide-react'

export type Leaf = {
  id: string; label: string; subtitle: string; icon: LucideIcon
  file: 'core' | 'quality' | 'ops' | 'admin'; export: string; view?: string
  roles?: string[] // role codes that may READ this page (mirrors API RBAC); undefined = all authenticated
}
export type Group = { id: string; label: string; icon: LucideIcon; leaves: Leaf[] }

const FIN = ['admin', 'finance_manager', 'station_supervisor']
const PAY = ['admin', 'finance_manager', 'export_officer', 'station_supervisor']
const ADM = ['admin']

export const NAV: Group[] = [
  { id: 'command', label: 'Command', icon: LayoutDashboard, leaves: [
    { id: 'dashboard', label: 'Executive Dashboard', subtitle: 'Live Operations Command Center — station & pipeline telemetry', icon: LayoutDashboard, file: 'core', export: 'Dashboard' },
    { id: 'financial', label: 'Financial Position', subtitle: 'Executive Financial & Contract Summary — committed vs unallocated stock, cash float, landed cost', icon: Landmark, file: 'core', export: 'FinancialPosition' },
    { id: 'notifications', label: 'Notifications', subtitle: 'Module 24 — anomalies, approvals and payroll events', icon: Bell, file: 'admin', export: 'NotificationsPage' },
  ]},
  { id: 'supply', label: 'Supply Base', icon: Sprout, leaves: [
    { id: 'farmers-directory', label: 'Farmer Directory', subtitle: 'Outgrower Registry — farmer profiles and delivery caps', icon: Users, file: 'core', export: 'Farmers', view: 'directory' },
    { id: 'farmers-kyc', label: 'KYC & Documents', subtitle: 'Farmer KYC status and document vault (national ID, land certificates)', icon: FileCheck, file: 'core', export: 'FarmerKyc' },
    { id: 'farmers-gis', label: 'Farm GIS & EUDR', subtitle: 'Farm polygons (PostGIS GeoJSON), certifications and Due Diligence Statements', icon: Map, file: 'core', export: 'Farmers', view: 'gis' },
    { id: 'collection-centers', label: 'Centers & Agents', subtitle: 'Collection centers and field purchasing agent assignments', icon: Warehouse, file: 'core', export: 'Collection', view: 'centers' },
    { id: 'collection-floats', label: 'Cash Floats', subtitle: 'Daily cash float allocation, spend and return per center', icon: Coins, file: 'core', export: 'CashFloats' },
    { id: 'collection-intake', label: 'Cherry Intake Terminal', subtitle: 'Weighbridge & scale terminal — gross / tare / net, deductions, QR receipts', icon: Scale, file: 'core', export: 'Collection', view: 'intake' },
  ]},
  { id: 'operations', label: 'Operations', icon: Cog, leaves: [
    { id: 'procurement-prices', label: 'Prices & Suppliers', subtitle: 'Daily grade-based buying prices and supplier (ACR/cooperative) configuration', icon: ShoppingCart, file: 'core', export: 'Procurement', view: 'prices' },
    { id: 'procurement-vouchers', label: 'Vouchers & GRNs', subtitle: 'Purchase ledger — voucher approval hierarchy and Goods Received Notes', icon: ClipboardList, file: 'core', export: 'Procurement', view: 'vouchers' },
    { id: 'processing-kanban', label: 'Processing Kanban', subtitle: 'Wet & natural processing workflow — FSM stage tracker (illegal skips blocked)', icon: KanbanSquare, file: 'core', export: 'Processing', view: 'kanban' },
    { id: 'processing-handover', label: 'Drying Beds & Handover', subtitle: 'Drying bed & storage handover form — moisture 10.5–11.5%, dual signatures', icon: Handshake, file: 'core', export: 'Processing', view: 'handover' },
    { id: 'drymill-orders', label: 'Milling Work Orders', subtitle: 'Dry mill batch terminal — hulling with mass-balance outturns', icon: Cog, file: 'core', export: 'DryMill', view: 'orders' },
    { id: 'drymill-grading', label: 'Grading & Sorting', subtitle: 'Screen sizing (14–18+), gravity & colour sorting log', icon: FlaskConical, file: 'core', export: 'DryMill', view: 'grading' },
  ]},
  { id: 'quality', label: 'Quality & Traceability', icon: ShieldCheck, leaves: [
    { id: 'lots-studio', label: 'Lot Studio', subtitle: 'Lot creation, splitting & blending — DAG genealogy with weight ratios', icon: GitBranch, file: 'quality', export: 'LotStudio', view: 'studio' },
    { id: 'lots-labels', label: 'QR Labels', subtitle: 'Lot barcode / QR print queue for bags and drying beds', icon: Package, file: 'quality', export: 'LotStudio', view: 'labels' },
    { id: 'traceability-tree', label: 'Traceability Tree', subtitle: 'Farm-to-export lineage explorer — forward & backward DAG', icon: GitBranch, file: 'quality', export: 'Traceability', view: 'tree' },
    { id: 'traceability-audit', label: 'Commingling Audit', subtitle: 'Anti-commingling monitor and end-to-end mass-balance reconciliation', icon: ShieldCheck, file: 'quality', export: 'Traceability', view: 'audit' },
    { id: 'quality-physical', label: 'Physical Lab', subtitle: 'Physical green analysis — moisture, water activity, defect counts', icon: FlaskConical, file: 'quality', export: 'Quality', view: 'physical' },
    { id: 'quality-cupping', label: 'Cupping & Approvals', subtitle: 'Q-Grader cupping scorecard (radar) and export-release approvals', icon: CupSoda, file: 'quality', export: 'Quality', view: 'cupping' },
  ]},
  { id: 'warehouse', label: 'Warehouse & Logistics', icon: Warehouse, leaves: [
    { id: 'warehouse-bins', label: 'Stores & Bins', subtitle: 'Segregated store & bin topology — parchment / natural / green, anti-commingling', icon: Boxes, file: 'quality', export: 'Warehouse', view: 'bins' },
    { id: 'warehouse-transfers', label: 'Transfers & Gate Passes', subtitle: 'Dual-signed stock receipts, inter-store transfers and gate passes', icon: Handshake, file: 'quality', export: 'Warehouse', view: 'transfers' },
    { id: 'warehouse-reconcile', label: 'Stock Reconciliation', subtitle: 'Physical stock audits — variance approval posts ledger adjustments', icon: PackageSearch, file: 'admin', export: 'Inventory', view: 'audits' },
    { id: 'logistics-fleet', label: 'Fleet', subtitle: 'Transporters, vehicles and drivers', icon: Truck, file: 'quality', export: 'Logistics', view: 'fleet' },
    { id: 'logistics-waybills', label: 'Waybills', subtitle: 'Dispatch waybill generator — station to mill / Addis', icon: ClipboardList, file: 'quality', export: 'Logistics', view: 'waybills' },
    { id: 'logistics-transit', label: 'Transit Monitor', subtitle: 'Station-to-Addis & Djibouti corridor tracking — shrinkage vs dispatch weight', icon: Route, file: 'quality', export: 'Logistics', view: 'transit' },
  ]},
  { id: 'resources', label: 'Resources', icon: Fuel, leaves: [
    { id: 'resources-fuel', label: 'Fuel Register', subtitle: 'የነዳጅ ፍጆታ መከታተያ ቅጽ — daily fuel register, litres ÷ kg pulped ratio', icon: Fuel, file: 'ops', export: 'Resources', view: 'fuel' },
    { id: 'resources-water', label: 'Water Register', subtitle: 'የውሃ ፍጆታ መከታተያ ቅጽ — midday meter readings, litres ÷ previous-day kg', icon: Droplets, file: 'ops', export: 'Resources', view: 'water' },
    { id: 'inventory', label: 'Inventory & Audits', subtitle: 'Consumables, packaging, fuel drums & spare parts — movements and stock audits', icon: PackageSearch, file: 'admin', export: 'Inventory', view: 'all' },
  ]},
  { id: 'people', label: 'People', icon: UserCog, leaves: [
    { id: 'hr-workers', label: 'Workers', subtitle: 'Seasonal worker registry — casual labour & operator onboarding', icon: Users, file: 'ops', export: 'HR', view: 'workers' },
    { id: 'hr-attendance', label: '30-Day Attendance Grid', subtitle: 'የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ — AG Grid, dual-verified (Controlled By / Verified By)', icon: CalendarDays, file: 'ops', export: 'HR', view: 'attendance' },
    { id: 'payroll', label: 'Payroll & Sign-Off', subtitle: 'የቀን ሠራተኞች መክፈያ ፔሮል — generated only from dual-verified attendance; Prepared ≠ Approved', icon: Wallet, file: 'ops', export: 'Payroll', roles: FIN },
  ]},
  { id: 'commerce', label: 'Commerce', icon: Building2, leaves: [
    { id: 'buyers', label: 'Buyers & Samples', subtitle: 'International buyer CRM and Pre-Shipment Sample (PSS) feedback log', icon: Building2, file: 'ops', export: 'Buyers', view: 'buyers' },
    { id: 'contracts', label: 'Contracts & Fixations', subtitle: 'Export sales contracts — outright / ICE "C" differential, lot allocation locks', icon: FileSignature, file: 'ops', export: 'Buyers', view: 'contracts' },
    { id: 'export-bagging', label: 'Bagging & Stencils', subtitle: 'Export bag marking & stencil generator — ICO marks, 60 kg jute / GrainPro', icon: Package, file: 'ops', export: 'ExportPage', view: 'bagging' },
    { id: 'export-containers', label: 'Containers & Documents', subtitle: 'Container loading & customs documentation suite — checklist gate before sealing', icon: Container, file: 'ops', export: 'ExportPage', view: 'containers' },
    { id: 'payments', label: 'Payments & Settlements', subtitle: 'Disbursements, export proceeds and LC/CAD reconciliation with NBE forex retention', icon: CreditCard, file: 'admin', export: 'Payments', roles: PAY },
  ]},
  { id: 'finance', label: 'Finance & Insight', icon: BookOpen, leaves: [
    { id: 'finance-gl', label: 'General Ledger', subtitle: 'Chart of accounts and multi-currency double-entry journals (debits = credits enforced)', icon: BookOpen, file: 'admin', export: 'Finance', view: 'gl', roles: FIN },
    { id: 'finance-arap', label: 'AR / AP', subtitle: 'Accounts receivable & payable ledger with settlement tracking', icon: ReceiptText, file: 'admin', export: 'FinanceArap', roles: FIN },
    { id: 'finance-costing', label: 'Lot Costing', subtitle: 'Landed cost & lot profitability — activity-based cost allocation per lot', icon: PiggyBank, file: 'admin', export: 'Finance', view: 'costing', roles: FIN },
    { id: 'bi', label: 'BI Reports', subtitle: 'Operational & compliance analytics — report builder and regulatory export', icon: BarChart3, file: 'admin', export: 'BI' },
  ]},
  { id: 'system', label: 'System', icon: Settings, leaves: [
    { id: 'mobile', label: 'Mobile Field & Sync', subtitle: 'Offline field data capture (IndexedDB queue) and sync conflict manager', icon: Smartphone, file: 'admin', export: 'MobileField' },
    { id: 'config', label: 'Configuration & Thresholds', subtitle: 'Master data & site topology, yield benchmarks and alert thresholds', icon: Settings, file: 'admin', export: 'SysConfig', roles: ADM },
    { id: 'users', label: 'Users, Roles & Signatures', subtitle: 'RBAC & station scoping, role permission matrix, digital signature credentials', icon: KeyRound, file: 'admin', export: 'Users', view: 'users', roles: ADM },
    { id: 'audit', label: 'Audit Log', subtitle: 'Immutable, hash-chained activity trail of every create / transition / sign-off', icon: ScrollText, file: 'admin', export: 'Users', view: 'audit', roles: ADM },
    { id: 'backups', label: 'Backups', subtitle: 'Module 25 — backup inventory and restore procedure', icon: DatabaseBackup, file: 'admin', export: 'BackupsPage', roles: ADM },
  ]},
]

export const ALL_LEAVES: Leaf[] = NAV.flatMap((g) => g.leaves.map((l) => ({ ...l })))
export const LEAF_BY_ID: Record<string, Leaf & { group: Group }> = {}
NAV.forEach((g) => g.leaves.forEach((l) => { LEAF_BY_ID[l.id] = { ...l, group: g } }))
export function canSee(leaf: Leaf, roleCodes: string[]): boolean {
  if (!leaf.roles) return true
  if (roleCodes.includes('admin')) return true
  return leaf.roles.some((r) => roleCodes.includes(r))
}
