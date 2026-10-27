import {
  LayoutDashboard, Landmark, Bell, Users, Map, FileCheck, Warehouse, Coins, ClipboardList,
  KanbanSquare, Handshake, Cog, FlaskConical, Scale, GitBranch, ShieldCheck, CupSoda,
  Boxes, Truck, Route, Fuel, Droplets, PackageSearch, UserCog, CalendarDays, Wallet,
  Building2, FileSignature, Package, Container, CreditCard, BookOpen, ReceiptText,
  PiggyBank, BarChart3, Smartphone, Settings, KeyRound, ScrollText, DatabaseBackup,
  Gauge, Factory, Video,
  Sprout, ShoppingCart, UserPlus, Clock, CalendarCheck, TrendingUp, GraduationCap,
  ClipboardCheck, Archive, LogOut, HeartHandshake, type LucideIcon,
} from 'lucide-react'

export type Leaf = {
  id: string; label: string; subtitle: string; labelAm?: string; subtitleAm?: string; icon: LucideIcon
  file: 'core' | 'quality' | 'ops' | 'admin' | 'farm' | 'site' | 'monitor' | 'hr'; export: string; view?: string
  roles?: string[] // role codes that may READ this page (mirrors API RBAC); undefined = all authenticated
}
export type Group = { id: string; label: string; labelAm?: string; icon: LucideIcon; leaves: Leaf[] }

const FIN = ['admin', 'finance_manager', 'finance_officer']
const PAY = ['admin', 'finance_manager', 'finance_officer', 'procurement_officer', 'site_manager', 'station_supervisor', 'export_officer']
const ADM = ['admin']
const FARM = ['admin', 'station_supervisor', 'purchaser', 'site_manager', 'procurement_officer', 'weighing_clerk', 'field_officer', 'quality_controller', 'finance_manager', 'finance_officer', 'export_officer']
const COLL = ['admin', 'station_supervisor', 'purchaser', 'site_manager', 'procurement_officer', 'weighing_clerk', 'field_officer', 'quality_controller', 'q_grader', 'finance_manager', 'finance_officer', 'warehouse_officer']
const PROC = ['admin', 'station_supervisor', 'purchaser', 'site_manager', 'procurement_officer', 'finance_manager', 'finance_officer']
const PROCS = ['admin', 'station_supervisor', 'industry_professional', 'dry_mill_manager', 'machine_operator', 'site_manager', 'quality_controller', 'q_grader', 'warehouse_officer']
const DRYM = ['admin', 'dry_mill_manager', 'industry_professional', 'site_manager', 'export_officer', 'warehouse_officer', 'quality_controller']
const TRACE = ['admin', 'station_supervisor', 'industry_professional', 'dry_mill_manager', 'site_manager', 'quality_controller', 'q_grader', 'export_officer']
const QUAL = ['admin', 'q_grader', 'industry_professional', 'quality_controller', 'site_manager', 'station_supervisor', 'export_officer', 'dry_mill_manager']
const WARE = ['admin', 'station_supervisor', 'industry_professional', 'dry_mill_manager', 'site_manager', 'warehouse_officer', 'export_officer']
const INV = ['admin', 'station_supervisor', 'dry_mill_manager', 'site_manager', 'warehouse_officer', 'industry_professional', 'finance_manager']
const LOGI = ['admin', 'export_officer', 'station_supervisor', 'site_manager', 'warehouse_officer', 'dry_mill_manager']
const RES = ['admin', 'station_supervisor', 'machine_operator', 'industry_professional', 'site_manager', 'weighing_clerk', 'finance_manager', 'finance_officer']
const HR = ['admin', 'station_supervisor', 'site_manager', 'finance_manager', 'finance_officer']
const HRADM = ['admin', 'hr_administrator', 'hr_manager', 'recruitment_officer', 'payroll_officer', 'finance_manager', 'finance_officer']
const HRREAD = [...HRADM, 'station_supervisor', 'site_manager']
const HREMP = [...HRREAD, 'employee']
const BUY = ['admin', 'export_officer', 'finance_manager']
const EXP = ['admin', 'export_officer', 'finance_manager', 'warehouse_officer']
const BIR = ['admin', 'finance_manager', 'station_supervisor', 'site_manager', 'finance_officer', 'export_officer']
const SYNCR = ['admin', 'station_supervisor', 'site_manager', 'machine_operator', 'weighing_clerk', 'field_officer']

export const NAV: Group[] = [
  { id: 'executive-dashboard', label: 'Executive Dashboard', labelAm: 'ዋና ዳሽቦርድ', icon: LayoutDashboard, leaves: [
    { id: 'dashboard', label: 'Executive Dashboard', subtitle: 'Live Operations Command Center — station & pipeline telemetry', labelAm: 'ዋና ዳሽቦርድ', subtitleAm: 'የቀጥታ ሥራ ማዕከል — የጣቢያ እና የሂደት መረጃ', icon: LayoutDashboard, file: 'core', export: 'Dashboard' },
    { id: 'financial', label: 'Financial Position', subtitle: 'Executive Financial & Contract Summary — committed vs unallocated stock, cash float, landed cost', labelAm: 'የፋይናንስ ሁኔታ', subtitleAm: 'የፋይናንስ እና የውል ማጠቃለያ — ክምችት፣ ገንዘብ እና ወጪ', icon: Landmark, file: 'core', export: 'FinancialPosition' , roles: ['admin', 'finance_manager', 'finance_officer', 'export_officer', 'site_manager'] },
    { id: 'site-performance', label: 'Site Performance', subtitle: 'Admin dashboard: compare sites & stations — volumes, costs, yields, quality, stock, efficiency, staff & alerts', labelAm: 'የጣቢያ አፈጻጸም', subtitleAm: 'የአስተዳዳሪ ዳሽቦርድ፦ ጣቢያዎችን አወዳድር — መጠን፣ ወጪ፣ ውጤት፣ ጥራት፣ ክምችት፣ ብቃት', icon: Gauge, file: 'site', export: 'SitePerformance', roles: ['admin', 'finance_manager', 'finance_officer', 'site_manager', 'station_supervisor'] },
    { id: 'notifications', label: 'Notifications', subtitle: 'Module 24 — anomalies, approvals and payroll events', labelAm: 'ማሳወቂያዎች', subtitleAm: 'ሞዱል 24 — ማስጠንቅቂያዎች፣ ማጽደቆች እና የደመወዝ ክስተቶች', icon: Bell, file: 'admin', export: 'NotificationsPage' },
    { id: 'bi', label: 'BI Reports', subtitle: 'Operational & compliance analytics — report builder and regulatory export', labelAm: 'ሪፖርቶች', subtitleAm: 'የሥራ እና የተገዢነት ትንታኔ — የሪፖርት ሰሪ እና ኤክስፖርት', icon: BarChart3, file: 'admin', export: 'BI' , roles: BIR },
  ]},
  { id: 'farmer-management', label: 'Farmer Management', labelAm: 'የገበሬዎች አስተዳደር', icon: Users, leaves: [
    { id: 'farmers-directory', label: 'Farmer Directory', subtitle: 'Outgrower Registry — farmer profiles and delivery caps', labelAm: 'የገበሬዎች ዝርዝር', subtitleAm: 'የገበሬ መገለጫዎች እና የማድረሻ ገደብ', icon: Users, file: 'core', export: 'Farmers', view: 'directory' , roles: FARM },
    { id: 'farmers-kyc', label: 'KYC & Documents', subtitle: 'Farmer KYC status and document vault (national ID, land certificates)', labelAm: 'ማንነትና ሰነዶች', subtitleAm: 'የገበሬ ማንነት ሁኔታ እና የሰነድ ማስቀመጫ', icon: FileCheck, file: 'core', export: 'FarmerKyc' , roles: FARM },
    { id: 'farmers-gis', label: 'Farm GIS & EUDR', subtitle: 'Farm polygons (PostGIS GeoJSON), certifications and Due Diligence Statements', labelAm: 'የእርሻ ካርታና EUDR', subtitleAm: 'የእርሻ ካርታዎች፣ የምስክር ወረቀቶች እና የEUDR መግለጫዎች', icon: Map, file: 'core', export: 'Farmers', view: 'gis' , roles: FARM },
    { id: 'farmer-planning', label: 'Farmer Planning', subtitle: 'Next-year production plans, targets and support needs per farmer', labelAm: 'የገበሬ እቅድ', subtitleAm: 'የሚቀጥለው ዓመት የምርት እቅዶች፣ ኢላማዎች እና የድጋፍ ፍላጎቶች', icon: Sprout, file: 'farm', export: 'FarmerPlanning' , roles: FARM },
    { id: 'bonus-center', label: 'Bonus Center', subtitle: 'Farmer bonuses (second payment) — kg-based scoring, calculation runs and approvals', labelAm: 'የጉርሻ ማዕከል', subtitleAm: 'የገበሬ ጉርሻ (ሁለተኛ ክፍያ) — በኪሎ ግራም ነጥብ፣ ስሌት እና ማጽደቅ', icon: PiggyBank, file: 'farm', export: 'BonusCenter' , roles: FARM },
    { id: 'bonus-settings', label: 'Bonus Settings', subtitle: 'Bonus schemes, kg tiers and quality multipliers (Settings submodule)', labelAm: 'የጉርሻ ቅንብሮች', subtitleAm: 'የጉርሻ እቅዶች፣ የኪሎ ግራም ደረጃዎች እና የጥራት ማባዣዎች (የቅንብር ክፍል)', icon: PiggyBank, file: 'farm', export: 'BonusCenter', view: 'settings', roles: FIN },
  ]},
  { id: 'farm-management', label: 'Farm Management', labelAm: 'የእርሻ አስተዳደር', icon: Factory, leaves: [
    { id: 'sites-directory', label: 'Sites & Washing Stations', subtitle: 'Site profiles: GPS, capacity, processing methods, equipment, utilities, staff & performance', labelAm: 'ጣቢያዎች እና ማጠቢያ ጣቢያዎች', subtitleAm: 'የጣቢያ መገለጫዎች፦ GPS፣ አቅም፣ ዘዴዎች፣ መሳሪያዎች፣ አገልግሎቶች፣ ሠራተኞች', icon: Factory, file: 'site', export: 'Sites' },
    { id: 'site-monitoring', label: 'Site Monitoring', subtitle: 'CCTV camera wall — 8 site cameras in a 4×2 grid; labelled demo feeds with real HLS/NVR integration', labelAm: 'የጣቢያ ክትትል', subtitleAm: 'የCCTV ካሜራ ግድግዳ — 8 የጣቢያ ካሜራዎች በ4×2 ፍርግርግ፤ የተሰየሙ የሙከራ ቻናሎች እና እውነተኛ HLS/NVR ውህደት', icon: Video, file: 'monitor', export: 'SiteMonitoring' },
    { id: 'resources-fuel', label: 'Fuel Register', subtitle: 'የነዳጅ ፍጆታ መከታተያ ቅጽ — daily fuel register, litres ÷ kg pulped ratio', labelAm: 'የነዳጅ መዝገብ', subtitleAm: 'የዕለት የነዳጅ መዝገብ፣ ሊትር ÷ ኪሎ ሬሽዮ', icon: Fuel, file: 'ops', export: 'Resources', view: 'fuel' , roles: RES },
    { id: 'resources-water', label: 'Water Register', subtitle: 'የውሃ ፍጆታ መከታተያ ቅጽ — midday meter readings, litres ÷ previous-day kg', labelAm: 'የውሃ መዝገብ', subtitleAm: 'የሰዓት መካከለኛ የሜትር ንባብ፣ ሊትር ÷ ኪሎ', icon: Droplets, file: 'ops', export: 'Resources', view: 'water' , roles: RES },
  ]},
  { id: 'procurement', label: 'Procurement', labelAm: 'ግዥ', icon: ShoppingCart, leaves: [
    { id: 'new-procurement', label: 'New Procurement', subtitle: 'Complete procurement form — record a cherry purchase and raise its voucher', labelAm: 'አዲስ ግዥ', subtitleAm: 'ሙሉ የግዥ ቅጽ — የቼሪ ግዥ መዝግብ እና ወረቀት አውጣ', icon: ShoppingCart, file: 'farm', export: 'NewProcurement' , roles: ['admin', 'station_supervisor', 'purchaser', 'site_manager', 'procurement_officer', 'finance_officer'] },
    { id: 'procurement-prices', label: 'Prices & Suppliers', subtitle: 'Daily grade-based buying prices and supplier (ACR/cooperative) configuration', labelAm: 'ዋጋና አቅራቢዎች', subtitleAm: 'የዕለት የግዥ ዋጋዎች እና የአቅራቢ ቅንብር', icon: ShoppingCart, file: 'core', export: 'Procurement', view: 'prices' , roles: PROC },
    { id: 'procurement-vouchers', label: 'Vouchers & GRNs', subtitle: 'Purchase ledger — voucher approval hierarchy and Goods Received Notes', labelAm: 'ክፍያ ወረቀቶች', subtitleAm: 'የግዥ መዝገብ — የወረቀት ማጽደቅ ደረጃዎች እና የመቀበያ ማስታወሻዎች', icon: ClipboardList, file: 'core', export: 'Procurement', view: 'vouchers' , roles: PROC },
    { id: 'collection-centers', label: 'Centers & Agents', subtitle: 'Collection centers and field purchasing agent assignments', labelAm: 'ማዕከላትና ወኪሎች', subtitleAm: 'የመሰብሰቢያ ማዕከላት እና የመስክ ወኪሎች ምደባ', icon: Warehouse, file: 'core', export: 'Collection', view: 'centers' , roles: COLL },
    { id: 'collection-floats', label: 'Cash Floats', subtitle: 'Daily cash float allocation, spend and return per center', labelAm: 'የገንዘብ ድልድል', subtitleAm: 'የዕለት ገንዘብ ድልድል፣ ወጪ እና መመለሻ', icon: Coins, file: 'core', export: 'CashFloats' , roles: COLL },
    { id: 'collection-intake', label: 'Cherry Intake Terminal', subtitle: 'Weighbridge & scale terminal — gross / tare / net, deductions, QR receipts', labelAm: 'የቼሪ መቀበያ', subtitleAm: 'የሚዛን ማሽን — ጠቅላላ / ባዶ / የተጣራ፣ ቅናሽ፣ የQR ደረሰኝ', icon: Scale, file: 'core', export: 'Collection', view: 'intake' , roles: COLL },
  ]},
  { id: 'processing', label: 'Processing', labelAm: 'ማዘጋጀት', icon: Cog, leaves: [
    { id: 'processing-kanban', label: 'Processing Kanban', subtitle: 'Wet & natural processing workflow — FSM stage tracker (illegal skips blocked)', labelAm: 'የማዘጋጀት ሂደት', subtitleAm: 'የእርጥብ እና የተፈጥሮ ማዘጋጀት ሂደት መከታተያ', icon: KanbanSquare, file: 'core', export: 'Processing', view: 'kanban' , roles: PROCS },
    { id: 'processing-handover', label: 'Drying Beds & Handover', subtitle: 'Drying bed & storage handover form — moisture 10.5–11.5%, dual signatures', labelAm: 'የማድረቂያ አልጋዎችና ርክክብ', subtitleAm: 'የአልጋ እና የማስቀመጫ ርክክብ ቅጽ — እርጥበት 10.5–11.5%', icon: Handshake, file: 'core', export: 'Processing', view: 'handover' , roles: PROCS },
    { id: 'drymill-orders', label: 'Milling Work Orders', subtitle: 'Dry mill batch terminal — hulling with mass-balance outturns', labelAm: 'የወፍጮ ሥራ ትዕዛዞች', subtitleAm: 'የደረቅ ወፍጮ ትዕዛዞች — የጅምላ ሚዛን ውጤቶች', icon: Cog, file: 'core', export: 'DryMill', view: 'orders' , roles: DRYM },
    { id: 'drymill-grading', label: 'Grading & Sorting', subtitle: 'Screen sizing (14–18+), gravity & colour sorting log', labelAm: 'ደረጃ መስጠትና መለየት', subtitleAm: 'የመጠን መለየት (14–18+)፣ የስበት እና የቀለም መለየት መዝገብ', icon: FlaskConical, file: 'core', export: 'DryMill', view: 'grading' , roles: DRYM },
    { id: 'lots-studio', label: 'Lot Studio', subtitle: 'Lot creation, splitting & blending — DAG genealogy with weight ratios', labelAm: 'የሎት አስተዳደር', subtitleAm: 'ሎት መፍጠር፣ መከፈል እና መቀላቀል — የዘር ሐረግ', icon: GitBranch, file: 'quality', export: 'LotStudio', view: 'studio' , roles: TRACE },
    { id: 'lots-labels', label: 'QR Labels', subtitle: 'Lot barcode / QR print queue for bags and drying beds', labelAm: 'የQR መለያዎች', subtitleAm: 'ለከረጢቶች እና ለአልጋዎች የሎት QR ማተሚያ ዝርዝር', icon: Package, file: 'quality', export: 'LotStudio', view: 'labels' , roles: TRACE },
  ]},
  { id: 'quality-control', label: 'Quality Control', labelAm: 'የጥራት ቁጥጥር', icon: ShieldCheck, leaves: [
    { id: 'quality-physical', label: 'Physical Lab', subtitle: 'Physical green analysis — moisture, water activity, defect counts', labelAm: 'የላብራቶሪ ምርመራ', subtitleAm: 'የአረንጓዴ ቡና ምርመራ — እርጥበት፣ የውሃ እንቅስቃሴ፣ ጉድለቶች', icon: FlaskConical, file: 'quality', export: 'Quality', view: 'physical' , roles: QUAL },
    { id: 'quality-cupping', label: 'Cupping & Approvals', subtitle: 'Q-Grader cupping scorecard (radar) and export-release approvals', labelAm: 'የቅምሻና ማጽደቅ', subtitleAm: 'የQ-Grader ቅምሻ ነጥብ ካርድ እና የኤክስፖርት ማጽደቅ', icon: CupSoda, file: 'quality', export: 'Quality', view: 'cupping' , roles: QUAL },
    { id: 'traceability-tree', label: 'Traceability Tree', subtitle: 'Farm-to-export lineage explorer — forward & backward DAG', labelAm: 'የመከታተያ ዛፍ', subtitleAm: 'ከእርሻ እስከ ኤክስፖርት የዘር ሐረግ መመርመሪያ', icon: GitBranch, file: 'quality', export: 'Traceability', view: 'tree' , roles: TRACE },
    { id: 'traceability-audit', label: 'Commingling Audit', subtitle: 'Anti-commingling monitor and end-to-end mass-balance reconciliation', labelAm: 'የድብልቅ ኦዲት', subtitleAm: 'የድብልቅ መከላከያ ክትትል እና የጅምላ ሚዛን ማመሳሰል', icon: ShieldCheck, file: 'quality', export: 'Traceability', view: 'audit' , roles: TRACE },
  ]},
  { id: 'inventory', label: 'Inventory', labelAm: 'ክምችት', icon: Boxes, leaves: [
    { id: 'warehouse-bins', label: 'Stores & Bins', subtitle: 'Segregated store & bin topology — parchment / natural / green, anti-commingling', labelAm: 'መጋዘኖች', subtitleAm: 'የተለዩ መጋዘኖች — በቆሎ / ተፈጥሮ / አረንጓዴ', icon: Boxes, file: 'quality', export: 'Warehouse', view: 'bins' , roles: WARE },
    { id: 'warehouse-transfers', label: 'Transfers & Gate Passes', subtitle: 'Dual-signed stock receipts, inter-store transfers and gate passes', labelAm: 'ዝውውርና የበር ፈቃድ', subtitleAm: 'ባለሁለት ፊርማ የተፈረሙ ዝውውሮች እና የበር ፈቃዶች', icon: Handshake, file: 'quality', export: 'Warehouse', view: 'transfers' , roles: WARE },
    { id: 'warehouse-reconcile', label: 'Stock Reconciliation', subtitle: 'Physical stock audits — variance approval posts ledger adjustments', labelAm: 'የክምችት ማመሳሰል', subtitleAm: 'የክምችት ኦዲት — ልዩነት ሲጸድቅ ወደ መዝገብ ይገባል', icon: PackageSearch, file: 'admin', export: 'Inventory', view: 'audits' , roles: INV },
    { id: 'inventory', label: 'Inventory & Audits', subtitle: 'Consumables, packaging, fuel drums & spare parts — movements and stock audits', labelAm: 'ክምችትና ኦዲት', subtitleAm: 'የፍጆታ እቃዎች፣ ማሸጊያ፣ የነዳጅ በርሜሎች እና መጠባበቂያዎች', icon: PackageSearch, file: 'admin', export: 'Inventory', view: 'all' , roles: INV },
  ]},
  { id: 'sales-export', label: 'Sales & Export', labelAm: 'ሽያጭና ኤክስፖርት', icon: Building2, leaves: [
    { id: 'buyers', label: 'Buyers & Samples', subtitle: 'International buyer CRM and Pre-Shipment Sample (PSS) feedback log', labelAm: 'ገዢዎችና ናሙናዎች', subtitleAm: 'የውጭ ገዢዎች CRM እና የናሙና አስተያየት መዝገብ', icon: Building2, file: 'ops', export: 'Buyers', view: 'buyers' , roles: BUY },
    { id: 'contracts', label: 'Contracts & Fixations', subtitle: 'Export sales contracts — outright / ICE "C" differential, lot allocation locks', labelAm: 'ውሎች', subtitleAm: 'የኤክስፖርት ሽያጭ ውሎች — የሎት ምደባ መቆለፊያዎች', icon: FileSignature, file: 'ops', export: 'Buyers', view: 'contracts' , roles: BUY },
    { id: 'export-bagging', label: 'Bagging & Stencils', subtitle: 'Export bag marking & stencil generator — ICO marks, 60 kg jute / GrainPro', labelAm: 'ከረጢት ማስገባትና ማተም', subtitleAm: 'የኤክስፖርት ከረጢት ምልክት እና ማተሚያ — 60 ኪሎ', icon: Package, file: 'ops', export: 'ExportPage', view: 'bagging' , roles: EXP },
    { id: 'export-containers', label: 'Containers & Documents', subtitle: 'Container loading & customs documentation suite — checklist gate before sealing', labelAm: 'ኮንቴይነሮችና ሰነዶች', subtitleAm: 'የኮንቴይነር ጭነት እና የጉምሩክ ሰነዶች — ከመዝጋት በፊት ማረጋገጫ', icon: Container, file: 'ops', export: 'ExportPage', view: 'containers' , roles: EXP },
  ]},
  { id: 'logistics', label: 'Logistics', labelAm: 'ሎጂስቲክስ', icon: Truck, leaves: [
    { id: 'logistics-fleet', label: 'Fleet', subtitle: 'Transporters, vehicles and drivers', labelAm: 'ተሽከርካሪዎች', subtitleAm: 'አጓጓዦች፣ ተሽከርካሪዎች እና ሹፌሮች', icon: Truck, file: 'quality', export: 'Logistics', view: 'fleet' , roles: LOGI },
    { id: 'logistics-waybills', label: 'Waybills', subtitle: 'Dispatch waybill generator — station to mill / Addis', labelAm: 'የጭነት ሰነዶች', subtitleAm: 'የጭነት ሰነድ አመንጭ — ከጣቢያ ወደ ወፍጮ / አዲስ አበባ', icon: ClipboardList, file: 'quality', export: 'Logistics', view: 'waybills' , roles: LOGI },
    { id: 'logistics-transit', label: 'Transit Monitor', subtitle: 'Station-to-Addis & Djibouti corridor tracking — shrinkage vs dispatch weight', labelAm: 'የጉዞ ክትትል', subtitleAm: 'የጣቢያ–አዲስ አበባ እና የጅቡቲ መስመር ክትትል', icon: Route, file: 'quality', export: 'Logistics', view: 'transit' , roles: LOGI },
  ]},
  { id: 'human-resources', label: 'Human Resources', labelAm: 'ሰው ሀብት', icon: UserCog, leaves: [
    { id: 'hr-dashboard', label: 'HR Dashboard', subtitle: 'Headcount, leave, vacancies, attendance and payroll cost', labelAm: 'የሰው ሀብት ዳሽቦርድ', subtitleAm: 'የሠራተኞች ቁጥር፣ ፈቃድ፣ ክፍት የሥራ ቦታዎች፣ መገኘት እና የደመወዝ ወጪ', icon: LayoutDashboard, file: 'hr', export: 'HRDashboard', roles: HRREAD },
    { id: 'hr-recruitment', label: 'Recruitment', subtitle: 'Manpower requests, vacancies, applications, candidates, screenings, interviews, assessments, offers', labelAm: 'ቅጥር', subtitleAm: 'የሰው ኃይል ጥያቄዎች፣ ክፍት ቦታዎች፣ ማመልከቻዎች፣ እጩዎች፣ ምርመራዎች፣ ቃለ መጠይቆች፣ ግምገማዎች፣ ቅናሾች', icon: UserPlus, file: 'hr', export: 'HRRecruitment', roles: HRADM },
    { id: 'hr-onboarding', label: 'Onboarding', subtitle: 'Onboarding checklists & tasks, employment contracts, document verification', labelAm: 'አቀባበል', subtitleAm: 'የአቀባበል ዝርዝሮችና ተግባራት፣ የቅጥር ውሎች፣ የሰነድ ማረጋገጫ', icon: ClipboardCheck, file: 'hr', export: 'HROnboarding', roles: HRADM },
    { id: 'hr-employees', label: 'Employees', subtitle: 'Employee directory & profiles — history, documents, status log, transfers & promotions; employees see only their own record', labelAm: 'ሠራተኞች', subtitleAm: 'የሠራተኞች ዝርዝርና መገለጫዎች — ታሪክ፣ ሰነዶች፣ የሁኔታ መዝገብ፣ ዝውውሮችና ማደጎች', icon: Users, file: 'hr', export: 'HREmployees', roles: HREMP },
    { id: 'hr-org', label: 'Org Structure', subtitle: 'Departments, job positions, job grades, reporting lines', labelAm: 'የድርጅት አወቃቀር', subtitleAm: 'መምሪያዎች፣ የሥራ መደቦች፣ የደረጃዎች፣ የሪፖርት መስመሮች', icon: GitBranch, file: 'hr', export: 'HROrgStructure', roles: HRREAD },
    { id: 'hr-attendance', label: 'Attendance & Time', subtitle: 'Shifts, shift assignments, time entries (offline check-in), timesheets, overtime', labelAm: 'መገኘትና ሰዓት', subtitleAm: 'ፈረቃዎች፣ የፈረቃ ምደባዎች፣ የሰዓት መዝገቦች (ከመስመር ውጭ መግቢያ)፣ የሰዓት ሉሆች፣ ተጨማሪ ሰዓት', icon: Clock, file: 'hr', export: 'HRAttendanceTime', roles: HRREAD },
    { id: 'hr-leave', label: 'Leave', subtitle: 'Leave types, balances and requests — approve / reject; employees see only their own', labelAm: 'ፈቃድ', subtitleAm: 'የፈቃድ አይነቶች፣ ቀሪ ቀናት እና ጥያቄዎች — ማጽደቅ / መቃወም', icon: CalendarCheck, file: 'hr', export: 'HRLeave', roles: HREMP },
    { id: 'hr-payroll', label: 'Payroll', subtitle: 'Salary structures, benefits, payroll rules, runs (calculate → verify → approve → post → pay), lines & payslips; employees see only their own payslips', labelAm: 'ደመወዝ', subtitleAm: 'የደመወዝ አወቃቀሮች፣ ጥቅማ ጥቅሞች፣ የደመወዝ ህጎች፣ ሩኖች፣ መስመሮችና የደመወዝ ወረቀቶች', icon: Wallet, file: 'hr', export: 'HRPayroll', roles: HREMP },
    { id: 'hr-performance', label: 'Performance', subtitle: 'KPIs and performance reviews', labelAm: 'አፈጻጸም', subtitleAm: 'ዋና የአፈጻጸም አመልካቾች እና የአፈጻጸም ግምገማዎች', icon: TrendingUp, file: 'hr', export: 'HRPerformance', roles: HRREAD },
    { id: 'hr-training', label: 'Training', subtitle: 'Training courses, plans, enrollments, certifications, competency assessments', labelAm: 'ሥልጠና', subtitleAm: 'የሥልጠና ኮርሶች፣ እቅዶች፣ ምዝገባዎች፣ የምስክር ወረቀቶች፣ የብቃት ግምገማዎች', icon: GraduationCap, file: 'hr', export: 'HRTraining', roles: HRREAD },
    { id: 'hr-relations', label: 'Employee Relations', subtitle: 'Grievances and disciplinary cases', labelAm: 'የሠራተኞች ግንኙነት', subtitleAm: 'ቅሬታዎች እና የዲሲፕሊን ጉዳዮች', icon: HeartHandshake, file: 'hr', export: 'HRRelations', roles: HRADM },
    { id: 'hr-assets', label: 'Assets & Clearance', subtitle: 'Company assets, asset returns and clearance checklists', labelAm: 'ንብረቶችና ማጽዳት', subtitleAm: 'የኩባንያ ንብረቶች፣ የንብረት መመለሻዎች እና የማጽዳት ዝርዝሮች', icon: Archive, file: 'hr', export: 'HRAssetsClearance', roles: HRREAD },
    { id: 'hr-separation', label: 'Separation', subtitle: 'Separation requests (manager → HR → settle → deactivate), handovers, exit interviews, final settlements', labelAm: 'መለያየት', subtitleAm: 'የመለያየት ጥያቄዎች፣ ርክክብ፣ የመውጫ ቃለ መጠይቆች፣ የመጨረሻ ክፍያዎች', icon: LogOut, file: 'hr', export: 'HRSeparation', roles: HRADM },
    { id: 'hr-reports', label: 'HR Reports', subtitle: 'HR report definitions and approval records', labelAm: 'የሰው ሀብት ሪፖርቶች', subtitleAm: 'የሪፖርት ፍቺዎች እና የማጽደቅ መዝገቦች', icon: BarChart3, file: 'hr', export: 'HRReports', roles: HRREAD },
    { id: 'hr-settings', label: 'HR Settings', subtitle: 'Tax brackets, pension rules, payroll rules, approval workflows, policies, shift policies', labelAm: 'የሰው ሀብት ቅንብሮች', subtitleAm: 'የግብር ደረጃዎች፣ የጡረታ ህጎች፣ የደመወዝ ህጎች፣ የማጽደቅ ሂደቶች፣ ፖሊሲዎች፣ የፈረቃ ፖሊሲዎች', icon: Settings, file: 'hr', export: 'HRSettings', roles: HRADM },
    { id: 'hr-workers', label: 'Workers (Seasonal)', subtitle: 'Seasonal worker registry — casual labour & operator onboarding', labelAm: 'ሠራተኞች', subtitleAm: 'የወቅት ሠራተኞች መዝገብ', icon: Users, file: 'ops', export: 'HR', view: 'workers' , roles: HR },
    { id: 'seasonal-attendance', label: '30-Day Attendance (Seasonal)', subtitle: 'የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ — AG Grid, dual-verified (Controlled By / Verified By)', labelAm: 'የ30 ቀን መገኘት ሰንጠረዥ', subtitleAm: 'የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ — ባለሁለት ማረጋገጫ', icon: CalendarDays, file: 'ops', export: 'HR', view: 'attendance' , roles: HR },
    { id: 'payroll', label: 'Seasonal Payroll & Sign-Off', subtitle: 'የቀን ሠራተኞች መክፈያ ፔሮል — generated only from dual-verified attendance; Prepared ≠ Approved', labelAm: 'ደመወዝና ማጽደቅ', subtitleAm: 'ከተረጋገጠ መገኘት ብቻ የሚዘጋጅ ደመወዝ፤ ዝግጅት ≠ ማጽደቅ', icon: Wallet, file: 'ops', export: 'Payroll', roles: FIN },
  ]},
  { id: 'finance', label: 'Finance', labelAm: 'ፋይናንስ', icon: BookOpen, leaves: [
    { id: 'finance-gl', label: 'General Ledger', subtitle: 'Chart of accounts and multi-currency double-entry journals (debits = credits enforced)', labelAm: 'ጠቅላላ መዝገብ', subtitleAm: 'የሂሳብ ሰንጠረዥ እና ባለብዙ ምንዛሪ እጥፍ-መግቢያ መዝገቦች', icon: BookOpen, file: 'admin', export: 'Finance', view: 'gl', roles: FIN },
    { id: 'finance-arap', label: 'AR / AP', subtitle: 'Accounts receivable & payable ledger with settlement tracking', labelAm: 'ተቀባይና ተከፋይ', subtitleAm: 'የተቀባይ እና የተከፋይ መዝገብ ከማቋረጫ ክትትል ጋር', icon: ReceiptText, file: 'admin', export: 'FinanceArap', roles: FIN },
    { id: 'finance-costing', label: 'Lot Costing', subtitle: 'Landed cost & lot profitability — activity-based cost allocation per lot', labelAm: 'የሎት ዋጋ ስሌት', subtitleAm: 'የሎት ትርፋማነት — በእንቅስቃሴ ላይ የተመሠረተ የወጪ ክፍፍል', icon: PiggyBank, file: 'admin', export: 'Finance', view: 'costing', roles: FIN },
    { id: 'payments', label: 'Payments & Settlements', subtitle: 'Disbursements, export proceeds and LC/CAD reconciliation with NBE forex retention', labelAm: 'ክፍያዎችና ማቋረጫ', subtitleAm: 'ክፍያዎች፣ የኤክስፖርት ገቢ እና የውጭ ምንዛሪ ማቋረጫ', icon: CreditCard, file: 'admin', export: 'Payments', roles: PAY },
  ]},
  { id: 'system-administration', label: 'System Administration', labelAm: 'የሲስተም አስተዳደር', icon: Settings, leaves: [
    { id: 'mobile', label: 'Mobile Field & Sync', subtitle: 'Offline field data capture (IndexedDB queue) and sync conflict manager', labelAm: 'የሞባይል መስክና አመሳስል', subtitleAm: 'ከመስመር ውጭ የመስክ መረጃ ቀረጻ እና የአመሳስል ግጭት አስተዳዳሪ', icon: Smartphone, file: 'admin', export: 'MobileField' , roles: SYNCR },
    { id: 'config', label: 'Configuration & Thresholds', subtitle: 'Master data & site topology, yield benchmarks and alert thresholds', labelAm: 'ቅንብሮችና ገደቦች', subtitleAm: 'ዋና መረጃ እና የጣቢያ አወቃቀር፣ የውጤት መለኪያዎች እና የማስጠንቅቂያ ገደቦች', icon: Settings, file: 'admin', export: 'SysConfig', roles: ADM },
    { id: 'roles-permissions', label: 'Roles & Permissions', subtitle: 'Module access matrix — which roles can read and write each module; changes apply immediately', labelAm: 'ሚናዎችና ፈቃዶች', subtitleAm: 'የሞዱል መዳረሻ ማትሪክስ — የትኞቹ ሚናዎች የትኛውን ሞዱል ማንበብ እና መጻፍ እንደሚችሉ፤ ለውጦች ወዲያውኑ ይተገበራሉ', icon: ShieldCheck, file: 'admin', export: 'RolesPermissions', roles: ADM },
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

// HR leaves are always LISTED for every authenticated user (visibility only).
// Access itself is still enforced by canSee() (Access Denied view) and by
// server-side RBAC on every HR API endpoint. Never use canList() for access.
// The rule is keyed on the LEAVES themselves (file === 'hr' / explicit HR leaf
// ids), not on a group id, so regrouping the sidebar cannot break it again.
// Seasonal leaves (file 'ops': hr-workers, seasonal-attendance, payroll) are
// intentionally NOT always-listed: they keep existing role filtering.
const HR_LEAF_IDS = new Set(['hr-dashboard', 'hr-recruitment', 'hr-onboarding', 'hr-employees', 'hr-org', 'hr-attendance', 'hr-leave', 'hr-payroll', 'hr-performance', 'hr-training', 'hr-relations', 'hr-assets', 'hr-separation', 'hr-reports', 'hr-settings'])
export function isHrLeaf(leaf: Leaf): boolean {
  return leaf.file === 'hr' || HR_LEAF_IDS.has(leaf.id)
}
export function canList(leaf: Leaf, roleCodes: string[]): boolean {
  if (isHrLeaf(leaf)) return true
  return canSee(leaf, roleCodes)
}
