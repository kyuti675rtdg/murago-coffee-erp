import {
  LayoutDashboard, Landmark, Bell, Users, Map, FileCheck, Warehouse, Coins, ClipboardList,
  KanbanSquare, Handshake, Cog, FlaskConical, Scale, GitBranch, ShieldCheck, CupSoda,
  Boxes, Truck, Route, Fuel, Droplets, PackageSearch, UserCog, CalendarDays, Wallet,
  Building2, FileSignature, Package, Container, CreditCard, BookOpen, ReceiptText,
  PiggyBank, BarChart3, Smartphone, Settings, KeyRound, ScrollText, DatabaseBackup,
  Gauge, Factory,
  Sprout, ShoppingCart, type LucideIcon,
} from 'lucide-react'

export type Leaf = {
  id: string; label: string; subtitle: string; labelAm?: string; subtitleAm?: string; icon: LucideIcon
  file: 'core' | 'quality' | 'ops' | 'admin' | 'farm' | 'site'; export: string; view?: string
  roles?: string[] // role codes that may READ this page (mirrors API RBAC); undefined = all authenticated
}
export type Group = { id: string; label: string; labelAm?: string; icon: LucideIcon; leaves: Leaf[] }

const FIN = ['admin', 'finance_manager', 'station_supervisor']
const PAY = ['admin', 'finance_manager', 'export_officer', 'station_supervisor']
const ADM = ['admin']

export const NAV: Group[] = [
  { id: 'command', label: 'Command', labelAm: 'ቁጥጥር', icon: LayoutDashboard, leaves: [
    { id: 'dashboard', label: 'Executive Dashboard', subtitle: 'Live Operations Command Center — station & pipeline telemetry', labelAm: 'ዋና ዳሽቦርድ', subtitleAm: 'የቀጥታ ሥራ ማዕከል — የጣቢያ እና የሂደት መረጃ', icon: LayoutDashboard, file: 'core', export: 'Dashboard' },
    { id: 'financial', label: 'Financial Position', subtitle: 'Executive Financial & Contract Summary — committed vs unallocated stock, cash float, landed cost', labelAm: 'የፋይናንስ ሁኔታ', subtitleAm: 'የፋይናንስ እና የውል ማጠቃለያ — ክምችት፣ ገንዘብ እና ወጪ', icon: Landmark, file: 'core', export: 'FinancialPosition' },
    { id: 'site-performance', label: 'Site Performance', subtitle: 'Admin dashboard: compare sites & stations — volumes, costs, yields, quality, stock, efficiency, staff & alerts', labelAm: 'የጣቢያ አፈጻጸም', subtitleAm: 'የአስተዳዳሪ ዳሽቦርድ፦ ጣቢያዎችን አወዳድር — መጠን፣ ወጪ፣ ውጤት፣ ጥራት፣ ክምችት፣ ብቃት', icon: Gauge, file: 'site', export: 'SitePerformance', roles: ['admin', 'finance_manager', 'finance_officer', 'site_manager', 'station_supervisor'] },
    { id: 'notifications', label: 'Notifications', subtitle: 'Module 24 — anomalies, approvals and payroll events', labelAm: 'ማሳወቂያዎች', subtitleAm: 'ሞዱል 24 — ማስጠንቅቂያዎች፣ ማጽደቆች እና የደመወዝ ክስተቶች', icon: Bell, file: 'admin', export: 'NotificationsPage' },
  ]},
  { id: 'supply', label: 'Supply Base', labelAm: 'አቅርቦት', icon: Sprout, leaves: [
    { id: 'sites-directory', label: 'Sites & Washing Stations', subtitle: 'Site profiles: GPS, capacity, processing methods, equipment, utilities, staff & performance', labelAm: 'ጣቢያዎች እና ማጠቢያ ጣቢያዎች', subtitleAm: 'የጣቢያ መገለጫዎች፦ GPS፣ አቅም፣ ዘዴዎች፣ መሳሪያዎች፣ አገልግሎቶች፣ ሠራተኞች', icon: Factory, file: 'site', export: 'Sites' },
    { id: 'farmers-directory', label: 'Farmer Directory', subtitle: 'Outgrower Registry — farmer profiles and delivery caps', labelAm: 'የገበሬዎች ዝርዝር', subtitleAm: 'የገበሬ መገለጫዎች እና የማድረሻ ገደብ', icon: Users, file: 'core', export: 'Farmers', view: 'directory' },
    { id: 'farmers-kyc', label: 'KYC & Documents', subtitle: 'Farmer KYC status and document vault (national ID, land certificates)', labelAm: 'ማንነትና ሰነዶች', subtitleAm: 'የገበሬ ማንነት ሁኔታ እና የሰነድ ማስቀመጫ', icon: FileCheck, file: 'core', export: 'FarmerKyc' },
    { id: 'farmer-planning', label: 'Farmer Planning', subtitle: 'Next-year production plans, targets and support needs per farmer', labelAm: 'የገበሬ እቅድ', subtitleAm: 'የሚቀጥለው ዓመት የምርት እቅዶች፣ ኢላማዎች እና የድጋፍ ፍላጎቶች', icon: Sprout, file: 'farm', export: 'FarmerPlanning' },
    { id: 'bonus-center', label: 'Bonus Center', subtitle: 'Farmer bonuses (second payment) — kg-based scoring, calculation runs and approvals', labelAm: 'የጉርሻ ማዕከል', subtitleAm: 'የገበሬ ጉርሻ (ሁለተኛ ክፍያ) — በኪሎ ግራም ነጥብ፣ ስሌት እና ማጽደቅ', icon: PiggyBank, file: 'farm', export: 'BonusCenter' },
    { id: 'farmers-gis', label: 'Farm GIS & EUDR', subtitle: 'Farm polygons (PostGIS GeoJSON), certifications and Due Diligence Statements', labelAm: 'የእርሻ ካርታና EUDR', subtitleAm: 'የእርሻ ካርታዎች፣ የምስክር ወረቀቶች እና የEUDR መግለጫዎች', icon: Map, file: 'core', export: 'Farmers', view: 'gis' },
    { id: 'collection-centers', label: 'Centers & Agents', subtitle: 'Collection centers and field purchasing agent assignments', labelAm: 'ማዕከላትና ወኪሎች', subtitleAm: 'የመሰብሰቢያ ማዕከላት እና የመስክ ወኪሎች ምደባ', icon: Warehouse, file: 'core', export: 'Collection', view: 'centers' },
    { id: 'collection-floats', label: 'Cash Floats', subtitle: 'Daily cash float allocation, spend and return per center', labelAm: 'የገንዘብ ድልድል', subtitleAm: 'የዕለት ገንዘብ ድልድል፣ ወጪ እና መመለሻ', icon: Coins, file: 'core', export: 'CashFloats' },
    { id: 'collection-intake', label: 'Cherry Intake Terminal', subtitle: 'Weighbridge & scale terminal — gross / tare / net, deductions, QR receipts', labelAm: 'የቼሪ መቀበያ', subtitleAm: 'የሚዛን ማሽን — ጠቅላላ / ባዶ / የተጣራ፣ ቅናሽ፣ የQR ደረሰኝ', icon: Scale, file: 'core', export: 'Collection', view: 'intake' },
  ]},
  { id: 'operations', label: 'Operations', labelAm: 'ሥራዎች', icon: Cog, leaves: [
    { id: 'new-procurement', label: 'New Procurement', subtitle: 'Complete procurement form — record a cherry purchase and raise its voucher', labelAm: 'አዲስ ግዥ', subtitleAm: 'ሙሉ የግዥ ቅጽ — የቼሪ ግዥ መዝግብ እና ወረቀት አውጣ', icon: ShoppingCart, file: 'farm', export: 'NewProcurement' },
    { id: 'procurement-prices', label: 'Prices & Suppliers', subtitle: 'Daily grade-based buying prices and supplier (ACR/cooperative) configuration', labelAm: 'ዋጋና አቅራቢዎች', subtitleAm: 'የዕለት የግዥ ዋጋዎች እና የአቅራቢ ቅንብር', icon: ShoppingCart, file: 'core', export: 'Procurement', view: 'prices' },
    { id: 'procurement-vouchers', label: 'Vouchers & GRNs', subtitle: 'Purchase ledger — voucher approval hierarchy and Goods Received Notes', labelAm: 'ክፍያ ወረቀቶች', subtitleAm: 'የግዥ መዝገብ — የወረቀት ማጽደቅ ደረጃዎች እና የመቀበያ ማስታወሻዎች', icon: ClipboardList, file: 'core', export: 'Procurement', view: 'vouchers' },
    { id: 'processing-kanban', label: 'Processing Kanban', subtitle: 'Wet & natural processing workflow — FSM stage tracker (illegal skips blocked)', labelAm: 'የማዘጋጀት ሂደት', subtitleAm: 'የእርጥብ እና የተፈጥሮ ማዘጋጀት ሂደት መከታተያ', icon: KanbanSquare, file: 'core', export: 'Processing', view: 'kanban' },
    { id: 'processing-handover', label: 'Drying Beds & Handover', subtitle: 'Drying bed & storage handover form — moisture 10.5–11.5%, dual signatures', labelAm: 'የማድረቂያ አልጋዎችና ርክክብ', subtitleAm: 'የአልጋ እና የማስቀመጫ ርክክብ ቅጽ — እርጥበት 10.5–11.5%', icon: Handshake, file: 'core', export: 'Processing', view: 'handover' },
    { id: 'drymill-orders', label: 'Milling Work Orders', subtitle: 'Dry mill batch terminal — hulling with mass-balance outturns', labelAm: 'የወፍጮ ሥራ ትዕዛዞች', subtitleAm: 'የደረቅ ወፍጮ ትዕዛዞች — የጅምላ ሚዛን ውጤቶች', icon: Cog, file: 'core', export: 'DryMill', view: 'orders' },
    { id: 'drymill-grading', label: 'Grading & Sorting', subtitle: 'Screen sizing (14–18+), gravity & colour sorting log', labelAm: 'ደረጃ መስጠትና መለየት', subtitleAm: 'የመጠን መለየት (14–18+)፣ የስበት እና የቀለም መለየት መዝገብ', icon: FlaskConical, file: 'core', export: 'DryMill', view: 'grading' },
  ]},
  { id: 'quality', label: 'Quality & Traceability', labelAm: 'ጥራትና መከታተያ', icon: ShieldCheck, leaves: [
    { id: 'lots-studio', label: 'Lot Studio', subtitle: 'Lot creation, splitting & blending — DAG genealogy with weight ratios', labelAm: 'የሎት አስተዳደር', subtitleAm: 'ሎት መፍጠር፣ መከፈል እና መቀላቀል — የዘር ሐረግ', icon: GitBranch, file: 'quality', export: 'LotStudio', view: 'studio' },
    { id: 'lots-labels', label: 'QR Labels', subtitle: 'Lot barcode / QR print queue for bags and drying beds', labelAm: 'የQR መለያዎች', subtitleAm: 'ለከረጢቶች እና ለአልጋዎች የሎት QR ማተሚያ ዝርዝር', icon: Package, file: 'quality', export: 'LotStudio', view: 'labels' },
    { id: 'traceability-tree', label: 'Traceability Tree', subtitle: 'Farm-to-export lineage explorer — forward & backward DAG', labelAm: 'የመከታተያ ዛፍ', subtitleAm: 'ከእርሻ እስከ ኤክስፖርት የዘር ሐረግ መመርመሪያ', icon: GitBranch, file: 'quality', export: 'Traceability', view: 'tree' },
    { id: 'traceability-audit', label: 'Commingling Audit', subtitle: 'Anti-commingling monitor and end-to-end mass-balance reconciliation', labelAm: 'የድብልቅ ኦዲት', subtitleAm: 'የድብልቅ መከላከያ ክትትል እና የጅምላ ሚዛን ማመሳሰል', icon: ShieldCheck, file: 'quality', export: 'Traceability', view: 'audit' },
    { id: 'quality-physical', label: 'Physical Lab', subtitle: 'Physical green analysis — moisture, water activity, defect counts', labelAm: 'የላብራቶሪ ምርመራ', subtitleAm: 'የአረንጓዴ ቡና ምርመራ — እርጥበት፣ የውሃ እንቅስቃሴ፣ ጉድለቶች', icon: FlaskConical, file: 'quality', export: 'Quality', view: 'physical' },
    { id: 'quality-cupping', label: 'Cupping & Approvals', subtitle: 'Q-Grader cupping scorecard (radar) and export-release approvals', labelAm: 'የቅምሻና ማጽደቅ', subtitleAm: 'የQ-Grader ቅምሻ ነጥብ ካርድ እና የኤክስፖርት ማጽደቅ', icon: CupSoda, file: 'quality', export: 'Quality', view: 'cupping' },
  ]},
  { id: 'warehouse', label: 'Warehouse & Logistics', labelAm: 'መጋዘንና ሎጂስቲክስ', icon: Warehouse, leaves: [
    { id: 'warehouse-bins', label: 'Stores & Bins', subtitle: 'Segregated store & bin topology — parchment / natural / green, anti-commingling', labelAm: 'መጋዘኖች', subtitleAm: 'የተለዩ መጋዘኖች — በቆሎ / ተፈጥሮ / አረንጓዴ', icon: Boxes, file: 'quality', export: 'Warehouse', view: 'bins' },
    { id: 'warehouse-transfers', label: 'Transfers & Gate Passes', subtitle: 'Dual-signed stock receipts, inter-store transfers and gate passes', labelAm: 'ዝውውርና የበር ፈቃድ', subtitleAm: 'ባለሁለት ፊርማ የተፈረሙ ዝውውሮች እና የበር ፈቃዶች', icon: Handshake, file: 'quality', export: 'Warehouse', view: 'transfers' },
    { id: 'warehouse-reconcile', label: 'Stock Reconciliation', subtitle: 'Physical stock audits — variance approval posts ledger adjustments', labelAm: 'የክምችት ማመሳሰል', subtitleAm: 'የክምችት ኦዲት — ልዩነት ሲጸድቅ ወደ መዝገብ ይገባል', icon: PackageSearch, file: 'admin', export: 'Inventory', view: 'audits' },
    { id: 'logistics-fleet', label: 'Fleet', subtitle: 'Transporters, vehicles and drivers', labelAm: 'ተሽከርካሪዎች', subtitleAm: 'አጓጓዦች፣ ተሽከርካሪዎች እና ሹፌሮች', icon: Truck, file: 'quality', export: 'Logistics', view: 'fleet' },
    { id: 'logistics-waybills', label: 'Waybills', subtitle: 'Dispatch waybill generator — station to mill / Addis', labelAm: 'የጭነት ሰነዶች', subtitleAm: 'የጭነት ሰነድ አመንጭ — ከጣቢያ ወደ ወፍጮ / አዲስ አበባ', icon: ClipboardList, file: 'quality', export: 'Logistics', view: 'waybills' },
    { id: 'logistics-transit', label: 'Transit Monitor', subtitle: 'Station-to-Addis & Djibouti corridor tracking — shrinkage vs dispatch weight', labelAm: 'የጉዞ ክትትል', subtitleAm: 'የጣቢያ–አዲስ አበባ እና የጅቡቲ መስመር ክትትል', icon: Route, file: 'quality', export: 'Logistics', view: 'transit' },
  ]},
  { id: 'resources', label: 'Resources', labelAm: 'ሀብቶች', icon: Fuel, leaves: [
    { id: 'resources-fuel', label: 'Fuel Register', subtitle: 'የነዳጅ ፍጆታ መከታተያ ቅጽ — daily fuel register, litres ÷ kg pulped ratio', labelAm: 'የነዳጅ መዝገብ', subtitleAm: 'የዕለት የነዳጅ መዝገብ፣ ሊትር ÷ ኪሎ ሬሽዮ', icon: Fuel, file: 'ops', export: 'Resources', view: 'fuel' },
    { id: 'resources-water', label: 'Water Register', subtitle: 'የውሃ ፍጆታ መከታተያ ቅጽ — midday meter readings, litres ÷ previous-day kg', labelAm: 'የውሃ መዝገብ', subtitleAm: 'የሰዓት መካከለኛ የሜትር ንባብ፣ ሊትር ÷ ኪሎ', icon: Droplets, file: 'ops', export: 'Resources', view: 'water' },
    { id: 'inventory', label: 'Inventory & Audits', subtitle: 'Consumables, packaging, fuel drums & spare parts — movements and stock audits', labelAm: 'ክምችትና ኦዲት', subtitleAm: 'የፍጆታ እቃዎች፣ ማሸጊያ፣ የነዳጅ በርሜሎች እና መጠባበቂያዎች', icon: PackageSearch, file: 'admin', export: 'Inventory', view: 'all' },
  ]},
  { id: 'people', label: 'People', labelAm: 'ሠራተኞች', icon: UserCog, leaves: [
    { id: 'hr-workers', label: 'Workers', subtitle: 'Seasonal worker registry — casual labour & operator onboarding', labelAm: 'ሠራተኞች', subtitleAm: 'የወቅት ሠራተኞች መዝገብ', icon: Users, file: 'ops', export: 'HR', view: 'workers' },
    { id: 'hr-attendance', label: '30-Day Attendance Grid', subtitle: 'የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ — AG Grid, dual-verified (Controlled By / Verified By)', labelAm: 'የ30 ቀን መገኘት ሰንጠረዥ', subtitleAm: 'የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ — ባለሁለት ማረጋገጫ', icon: CalendarDays, file: 'ops', export: 'HR', view: 'attendance' },
    { id: 'payroll', label: 'Payroll & Sign-Off', subtitle: 'የቀን ሠራተኞች መክፈያ ፔሮል — generated only from dual-verified attendance; Prepared ≠ Approved', labelAm: 'ደመወዝና ማጽደቅ', subtitleAm: 'ከተረጋገጠ መገኘት ብቻ የሚዘጋጅ ደመወዝ፤ ዝግጅት ≠ ማጽደቅ', icon: Wallet, file: 'ops', export: 'Payroll', roles: FIN },
  ]},
  { id: 'commerce', label: 'Commerce', labelAm: 'ንግድ', icon: Building2, leaves: [
    { id: 'buyers', label: 'Buyers & Samples', subtitle: 'International buyer CRM and Pre-Shipment Sample (PSS) feedback log', labelAm: 'ገዢዎችና ናሙናዎች', subtitleAm: 'የውጭ ገዢዎች CRM እና የናሙና አስተያየት መዝገብ', icon: Building2, file: 'ops', export: 'Buyers', view: 'buyers' },
    { id: 'contracts', label: 'Contracts & Fixations', subtitle: 'Export sales contracts — outright / ICE "C" differential, lot allocation locks', labelAm: 'ውሎች', subtitleAm: 'የኤክስፖርት ሽያጭ ውሎች — የሎት ምደባ መቆለፊያዎች', icon: FileSignature, file: 'ops', export: 'Buyers', view: 'contracts' },
    { id: 'export-bagging', label: 'Bagging & Stencils', subtitle: 'Export bag marking & stencil generator — ICO marks, 60 kg jute / GrainPro', labelAm: 'ከረጢት ማስገባትና ማተም', subtitleAm: 'የኤክስፖርት ከረጢት ምልክት እና ማተሚያ — 60 ኪሎ', icon: Package, file: 'ops', export: 'ExportPage', view: 'bagging' },
    { id: 'export-containers', label: 'Containers & Documents', subtitle: 'Container loading & customs documentation suite — checklist gate before sealing', labelAm: 'ኮንቴይነሮችና ሰነዶች', subtitleAm: 'የኮንቴይነር ጭነት እና የጉምሩክ ሰነዶች — ከመዝጋት በፊት ማረጋገጫ', icon: Container, file: 'ops', export: 'ExportPage', view: 'containers' },
    { id: 'payments', label: 'Payments & Settlements', subtitle: 'Disbursements, export proceeds and LC/CAD reconciliation with NBE forex retention', labelAm: 'ክፍያዎችና ማቋረጫ', subtitleAm: 'ክፍያዎች፣ የኤክስፖርት ገቢ እና የውጭ ምንዛሪ ማቋረጫ', icon: CreditCard, file: 'admin', export: 'Payments', roles: PAY },
  ]},
  { id: 'finance', label: 'Finance & Insight', labelAm: 'ፋይናንስ', icon: BookOpen, leaves: [
    { id: 'finance-gl', label: 'General Ledger', subtitle: 'Chart of accounts and multi-currency double-entry journals (debits = credits enforced)', labelAm: 'ጠቅላላ መዝገብ', subtitleAm: 'የሂሳብ ሰንጠረዥ እና ባለብዙ ምንዛሪ እጥፍ-መግቢያ መዝገቦች', icon: BookOpen, file: 'admin', export: 'Finance', view: 'gl', roles: FIN },
    { id: 'finance-arap', label: 'AR / AP', subtitle: 'Accounts receivable & payable ledger with settlement tracking', labelAm: 'ተቀባይና ተከፋይ', subtitleAm: 'የተቀባይ እና የተከፋይ መዝገብ ከማቋረጫ ክትትል ጋር', icon: ReceiptText, file: 'admin', export: 'FinanceArap', roles: FIN },
    { id: 'finance-costing', label: 'Lot Costing', subtitle: 'Landed cost & lot profitability — activity-based cost allocation per lot', labelAm: 'የሎት ዋጋ ስሌት', subtitleAm: 'የሎት ትርፋማነት — በእንቅስቃሴ ላይ የተመሠረተ የወጪ ክፍፍል', icon: PiggyBank, file: 'admin', export: 'Finance', view: 'costing', roles: FIN },
    { id: 'bi', label: 'BI Reports', subtitle: 'Operational & compliance analytics — report builder and regulatory export', labelAm: 'ሪፖርቶች', subtitleAm: 'የሥራ እና የተገዢነት ትንታኔ — የሪፖርት ሰሪ እና ኤክስፖርት', icon: BarChart3, file: 'admin', export: 'BI' },
  ]},
  { id: 'system', label: 'System', labelAm: 'ሲስተም', icon: Settings, leaves: [
    { id: 'mobile', label: 'Mobile Field & Sync', subtitle: 'Offline field data capture (IndexedDB queue) and sync conflict manager', labelAm: 'የሞባይል መስክና አመሳስል', subtitleAm: 'ከመስመር ውጭ የመስክ መረጃ ቀረጻ እና የአመሳስል ግጭት አስተዳዳሪ', icon: Smartphone, file: 'admin', export: 'MobileField' },
    { id: 'bonus-settings', label: 'Bonus Settings', subtitle: 'Bonus schemes, kg tiers and quality multipliers (Settings submodule)', labelAm: 'የጉርሻ ቅንብሮች', subtitleAm: 'የጉርሻ እቅዶች፣ የኪሎ ግራም ደረጃዎች እና የጥራት ማባዣዎች (የቅንብር ክፍል)', icon: PiggyBank, file: 'farm', export: 'BonusCenter', view: 'settings', roles: FIN },
    { id: 'config', label: 'Configuration & Thresholds', subtitle: 'Master data & site topology, yield benchmarks and alert thresholds', labelAm: 'ቅንብሮችና ገደቦች', subtitleAm: 'ዋና መረጃ እና የጣቢያ አወቃቀር፣ የውጤት መለኪያዎች እና የማስጠንቅቂያ ገደቦች', icon: Settings, file: 'admin', export: 'SysConfig', roles: ADM },
    { id: 'users', label: 'Users, Roles & Signatures', subtitle: 'RBAC & station scoping, role permission matrix, digital signature credentials', labelAm: 'ተጠቃሚዎች፣ ሚናዎችና ፊርማዎች', subtitleAm: 'ሚና-ተኮር ፈቃድ እና የጣቢያ ወሰን፣ የፊርማ ማረጋገጫዎች', icon: KeyRound, file: 'admin', export: 'Users', view: 'users', roles: ADM },
    { id: 'audit', label: 'Audit Log', subtitle: 'Immutable, hash-chained activity trail of every create / transition / sign-off', labelAm: 'የኦዲት መዝገብ', subtitleAm: 'የማይቀየር የኦዲት መዝገብ — እያንዳንዱ ፈጠራ / ሽግግር / ማጽደቅ', icon: ScrollText, file: 'admin', export: 'Users', view: 'audit', roles: ADM },
    { id: 'backups', label: 'Backups', subtitle: 'Module 25 — backup inventory and restore procedure', labelAm: 'ምትኬዎች', subtitleAm: 'ሞዱል 25 — የምትኬ ዝርዝር እና የማስመለስ ሂደት', icon: DatabaseBackup, file: 'admin', export: 'BackupsPage', roles: ADM },
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
