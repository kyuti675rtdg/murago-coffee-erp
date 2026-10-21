import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import { Bar, BarChart, CartesianGrid, Cell, Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { api, clearQueued, list, post, queueOffline, queuedRecords, uuidv7, DEMO_MODE } from './api'
import { DEMO, DEMO_DASHBOARD } from './demo'
import { useAuth } from './store'

ModuleRegistry.registerModules([AllCommunityModule])

/* ---------------- toast ---------------- */
const ToastCtx = createContext<(msg: string, ok?: boolean) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

/* ---------------- helpers ---------------- */
export function useList(path: string, demoKey?: string) {
  const q = useQuery({ queryKey: ['list', path], queryFn: () => list(path) })
  const fallback = !!(q.error && DEMO_MODE && demoKey && DEMO[demoKey])
  return { ...q, rows: (q.data ?? (fallback ? DEMO[demoKey] : [])) as any[], fallback }
}
export function errMsg(e: any): string { return e?.body?.detail || e?.message || 'Request failed' }
export function T({ rows, cols }: { rows: any[]; cols: [string, string][] }) {
  if (!rows.length) return <p className="text-sm text-stone-400 py-3">No records yet.</p>
  return (<div className="overflow-x-auto"><table className="w-full"><thead><tr>{cols.map(([k, l]) => <th key={k} className="th">{l}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id ?? i}>{cols.map(([k]) => <td key={k} className="td">{String(r[k] ?? '—')}</td>)}</tr>)}</tbody></table></div>)
}
export function Section({ title, sub, children }: any) {
  return <section className="card mb-4"><h3 className="font-bold text-stone-800">{title}</h3>{sub && <p className="text-xs text-stone-500 mb-2">{sub}</p>}<div className="mt-2">{children}</div></section>
}
export function DemoBanner({ show }: { show: boolean }) {
  return show ? <div className="mb-3 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-900 text-xs px-3 py-2">⚠ API unreachable — showing clearly-labelled DEMO data (local-dev fallback only). Live deployment uses real APIs.</div> : null
}
export function Field({ label, children }: any) { return <label className="block"><span className="lbl">{label}</span>{children}</label> }
export function useStations() { return useList('/stations/') }
export function StationSelect({ value, onChange }: any) {
  const { rows } = useStations()
  return <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select station…</option>{rows.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
}
export function useUsers() { return useQuery({ queryKey: ['users'], queryFn: () => api('/api/users/') }) }
export function UserSelect({ value, onChange }: any) {
  const { data } = useUsers()
  return <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select user…</option>{(data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.username}</option>)}</select>
}

/* ---------------- login ---------------- */
function Login() {
  const { login } = useAuth(); const [u, setU] = useState('admin'); const [p, setP] = useState(''); const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setErr(''); try { await login(u, p) } catch (x: any) { setErr(errMsg(x)) } }
  return (<div className="min-h-screen flex items-center justify-center bg-stone-900 p-4">
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
      <div className="text-4xl mb-2">☕</div><h1 className="text-xl font-bold">Murago Coffee ERP</h1>
      <p className="text-sm text-stone-500 mb-4">Bean Power ERP — farm to export. Sign in with your station account.</p>
      {err && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{err}</div>}
      <Field label="Username"><input className="inp" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></Field>
      <div className="mt-3"><Field label="Password"><input className="inp" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></Field></div>
      <button className="btn w-full justify-center mt-5">Sign in</button>
      <p className="text-[11px] text-stone-400 mt-3">Demo login is documented in the delivery verification doc.</p>
    </form></div>)
}

/* ---------------- 1. Executive Dashboard ---------------- */
const STAGES = ['harvesting_sorting', 'receiving', 'pulping', 'fermenting', 'washing', 'drying', 'conditioning', 'dry_milling', 'bag_marking', 'packing', 'storing', 'exporting']
function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard/') })
  const d = q.data ?? (q.error && DEMO_MODE ? DEMO_DASHBOARD : null)
  const { rows: snapshots } = useList('/dashboard-snapshots/')
  if (!d) return <p className="text-sm">{q.error ? `Dashboard unavailable: ${errMsg(q.error)}` : 'Loading…'}</p>
  const stageData = STAGES.map((s) => ({ stage: s.replace(/_/g, ' '), lots: d.lots_by_stage?.[s] ?? 0 }))
  const kpis: [string, any][] = [['Lots in pipeline', d.lots_total], ['Cherry procured (kg)', d.cherry_procured_kg], ['Warehouse stock (kg)', d.warehouse_stock_kg], ['Open export contracts', d.open_contracts], ['Committed stock (kg)', d.committed_kg], ['Farmers registered', d.farmers], ['Containers open', d.containers_open], ['Avg fuel ratio (L/kg)', String(d.avg_fuel_ratio).slice(0, 7)], ['Avg water ratio (L/kg)', String(d.avg_water_ratio).slice(0, 7)], ['Fuel anomalies', d.fuel_anomalies], ['Water anomalies', d.water_anomalies]]
  return (<div><DemoBanner show={!!(q.error && DEMO_MODE)} />
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">{kpis.map(([l, v]) => <div key={l} className="card"><div className="lbl">{l}</div><div className="kpi">{String(v)}</div></div>)}</div>
    <Section title="Station & Pipeline Telemetry — lots by FSM stage" sub="Live Operations Command Center · contract position: committed vs warehouse stock shown above">
      <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stageData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="lots" fill="#d97706" /></BarChart></ResponsiveContainer></div>
    </Section>
    <Section title="Executive Financial & Contract Summary (snapshots)"><T rows={snapshots} cols={[['snapshot_date', 'Date'], ['cherry_procured_kg', 'Cherry kg'], ['warehouse_stock_kg', 'Stock kg'], ['cash_float_balance', 'Cash float'], ['landed_cost_per_kg', 'Landed cost/kg'], ['export_containers_open', 'Containers']]} /></Section>
  </div>)
}

/* ---------------- 2. Farmers + GIS ---------------- */
function FarmerMap({ plots }: { plots: any[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const map = L.map(ref.current).setView([6.6, 38.4167], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map)
    plots.forEach((p) => {
      const gj = p.boundary_geojson
      if (gj?.coordinates?.[0]) {
        const latlngs = gj.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number])
        L.polygon(latlngs, { color: '#d97706' }).addTo(map).bindPopup(`${p.plot_name || 'Plot'} — ${p.area_ha ?? ''} ha · EUDR deforestation-free: ${p.deforestation_free ? 'yes' : 'no'}`)
      }
    })
    return () => { map.remove() }
  }, [plots])
  return <div ref={ref} className="h-72 rounded-xl border border-stone-200 z-0" />
}
function Farmers() {
  const { rows, fallback } = useList('/farmers/', 'farmers')
  const plots = useList('/farm-plots/')
  const certs = useList('/certifications/')
  const dds = useList('/eudr-statements/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ farmer_code: '', full_name: '', phone: '', kebele: '', coffee_tree_count: 0, annual_cherry_cap_kg: 0, station: '' })
  const create = useMutation({ mutationFn: () => post('/farmers/', f), onSuccess: () => { toast('Farmer registered'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div><DemoBanner show={fallback} />
    <Section title="Farmer Directory & Profile View — Outgrower Registry & KYC" sub="Annual cherry cap (anti-illicit-blending) enforced from registered plot size">
      <T rows={rows} cols={[['farmer_code', 'Farmer ID'], ['full_name', 'Name'], ['phone', 'Phone'], ['kebele', 'Kebele'], ['coffee_tree_count', 'Trees'], ['annual_cherry_cap_kg', 'Cap kg/yr'], ['delivered_this_season_kg', 'Delivered kg'], ['kyc_status', 'KYC']]} />
      <div className="grid md:grid-cols-4 gap-2 mt-3">
        <Field label="Farmer ID"><input className="inp" value={f.farmer_code} onChange={(e) => setF({ ...f, farmer_code: e.target.value })} placeholder="FRM-2026-0100" /></Field>
        <Field label="Full name"><input className="inp" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Station"><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
        <Field label="Annual cap (kg)"><input className="inp" type="number" value={f.annual_cherry_cap_kg} onChange={(e) => setF({ ...f, annual_cherry_cap_kg: e.target.value })} /></Field>
      </div><button className="btn mt-2" onClick={() => create.mutate()}>Register farmer</button>
    </Section>
    <Section title="Interactive Polygon Map & Document Vault — Farm GIS & EUDR" sub="PostGIS GeoJSON polygons · certifications · Due Diligence Statements">
      <FarmerMap plots={plots.rows} />
      <div className="grid md:grid-cols-2 gap-4 mt-3"><div><h4 className="font-semibold text-sm mb-1">Farm plots</h4><T rows={plots.rows} cols={[['plot_name', 'Plot'], ['area_ha', 'ha'], ['elevation_m', 'Elev. m'], ['coffee_variety', 'Variety'], ['deforestation_free', 'Deforestation-free']]} /></div>
        <div><h4 className="font-semibold text-sm mb-1">Certifications & EUDR DDS</h4><T rows={certs.rows} cols={[['cert_type', 'Type'], ['certificate_number', 'Cert #'], ['expires_on', 'Expires']]} /><T rows={dds.rows} cols={[['reference_number', 'DDS ref'], ['status', 'Status']]} /></div></div>
    </Section></div>)
}

/* ---------------- 3. Collection ---------------- */
function Collection() {
  const centers = useList('/collection-centers/'); const floats = useList('/cash-floats/')
  const intakes = useList('/cherry-intakes/'); const farmers = useList('/farmers/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ intake_number: '', farmer: '', center: '', station: '', intake_date: new Date().toISOString().slice(0, 10), coffee_variety: 'Heirloom', gross_kg: 0, tare_kg: 0, floater_deduction_pct: 0, unit_price: 85, qr_receipt_code: '' })
  const net = Math.max(0, (Number(f.gross_kg) || 0) - (Number(f.tare_kg) || 0))
  const payable = net * (1 - (Number(f.floater_deduction_pct) || 0) / 100)
  const create = useMutation({ mutationFn: () => post('/cherry-intakes/', { ...f, qr_receipt_code: f.qr_receipt_code || `QR-${f.intake_number}` }), onSuccess: (d: any) => { toast(`Intake saved — net ${d.net_kg} kg, payable ${d.payable_kg} kg, total ${d.total_amount} ETB · QR receipt: ${d.qr_receipt_code}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Collection Center & Agent Assignment"><T rows={centers.rows} cols={[['code', 'Code'], ['name', 'Center'], ['altitude_m', 'Altitude m'], ['is_active', 'Active']]} /><T rows={floats.rows} cols={[['float_date', 'Date'], ['amount_allocated', 'Float allocated'], ['amount_spent', 'Spent'], ['amount_returned', 'Returned'], ['status', 'Status']]} /></Section>
    <Section title="Daily Cherry Intake & Scale Terminal — Weighbridge" sub="net = gross − tare · payable = net − floatation deduction · QR intake receipt issued on save">
      <div className="grid md:grid-cols-4 gap-2">
        <Field label="Intake #"><input className="inp" value={f.intake_number} onChange={(e) => setF({ ...f, intake_number: e.target.value })} placeholder="INT-2026-0002" /></Field>
        <Field label="Farmer"><select className="inp" value={f.farmer} onChange={(e) => setF({ ...f, farmer: e.target.value })}><option value="">Select…</option>{farmers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.farmer_code} — {x.full_name}</option>)}</select></Field>
        <Field label="Center"><select className="inp" value={f.center} onChange={(e) => setF({ ...f, center: e.target.value })}><option value="">Select…</option>{centers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Station"><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
        <Field label="Gross (kg)"><input className="inp" type="number" value={f.gross_kg} onChange={(e) => setF({ ...f, gross_kg: e.target.value })} /></Field>
        <Field label="Tare (kg)"><input className="inp" type="number" value={f.tare_kg} onChange={(e) => setF({ ...f, tare_kg: e.target.value })} /></Field>
        <Field label="Floatation deduction %"><input className="inp" type="number" value={f.floater_deduction_pct} onChange={(e) => setF({ ...f, floater_deduction_pct: e.target.value })} /></Field>
        <Field label="Unit price (ETB/kg)"><input className="inp" type="number" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-sm"><span>Net: <b>{net.toFixed(2)} kg</b></span><span>Payable: <b>{payable.toFixed(2)} kg</b></span><span>Total: <b>{(payable * (Number(f.unit_price) || 0)).toFixed(2)} ETB</b></span>
        <button className="btn" onClick={() => create.mutate()}>Record intake + print QR receipt</button></div>
      <div className="mt-3"><T rows={intakes.rows} cols={[['intake_number', 'Intake #'], ['intake_date', 'Date'], ['gross_kg', 'Gross'], ['tare_kg', 'Tare'], ['net_kg', 'Net'], ['payable_kg', 'Payable'], ['total_amount', 'Total ETB'], ['qr_receipt_code', 'QR receipt']]} /></div>
    </Section></div>)
}

/* ---------------- 4. Procurement ---------------- */
function Procurement() {
  const prices = useList('/daily-prices/'); const vouchers = useList('/purchase-vouchers/'); const grns = useList('/grns/'); const suppliers = useList('/suppliers/')
  const toast = useToast(); const qc = useQueryClient()
  const [p, setP] = useState<any>({ station: '', price_date: new Date().toISOString().slice(0, 10), product: 'cherry', grade: '1', price_per_kg: 85 })
  const create = useMutation({ mutationFn: () => post('/daily-prices/', p), onSuccess: () => { toast('Daily price set'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Daily Buying Price & Supplier Configuration">
      <div className="grid md:grid-cols-5 gap-2"><Field label="Station"><StationSelect value={p.station} onChange={(v: string) => setP({ ...p, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={p.price_date} onChange={(e) => setP({ ...p, price_date: e.target.value })} /></Field>
        <Field label="Product"><select className="inp" value={p.product} onChange={(e) => setP({ ...p, product: e.target.value })}><option value="cherry">Red cherry</option><option value="parchment">Parchment</option></select></Field>
        <Field label="Grade"><input className="inp" value={p.grade} onChange={(e) => setP({ ...p, grade: e.target.value })} /></Field>
        <Field label="Price / kg"><input className="inp" type="number" value={p.price_per_kg} onChange={(e) => setP({ ...p, price_per_kg: e.target.value })} /></Field></div>
      <button className="btn mt-2" onClick={() => create.mutate()}>Set daily price</button>
      <T rows={prices.rows} cols={[['price_date', 'Date'], ['product', 'Product'], ['grade', 'Grade'], ['price_per_kg', 'ETB/kg']]} />
      <h4 className="font-semibold text-sm mt-3">Suppliers (ACRs / cooperatives)</h4><T rows={suppliers.rows} cols={[['code', 'Code'], ['name', 'Supplier'], ['supplier_type', 'Type'], ['phone', 'Phone']]} />
    </Section>
    <Section title="Purchase Ledger & Voucher Approval — Vouchers & GRNs"><T rows={vouchers.rows} cols={[['voucher_number', 'Voucher'], ['voucher_date', 'Date'], ['quantity_kg', 'Qty kg'], ['total_amount', 'Total'], ['status', 'Status']]} /><T rows={grns.rows} cols={[['grn_number', 'GRN'], ['received_date', 'Received'], ['received_kg', 'Received kg'], ['variance_kg', 'Variance']]} /></Section>
  </div>)
}

/* ---------------- 5. Processing Kanban + Handover ---------------- */
function Processing() {
  const { rows: lots, fallback } = useList('/lots/', 'lots')
  const toast = useToast(); const qc = useQueryClient()
  const advance = useMutation({ mutationFn: (lot: any) => post(`/lots/${lot.id}/advance/`, {}), onSuccess: (d: any) => { toast(`Lot advanced → ${d.to_stage}`); qc.invalidateQueries() }, onError: (e: any) => toast(`Illegal move blocked: ${errMsg(e)}`, false) })
  const moveTo = useMutation({ mutationFn: ({ lot, stage }: any) => post(`/lots/${lot.id}/transition/`, { to_stage: stage }), onSuccess: () => { toast('Transition recorded'); qc.invalidateQueries() }, onError: (e: any) => toast(`Illegal move blocked: ${errMsg(e)}`, false) })
  return (<div><DemoBanner show={fallback} />
    <Section title="Station Processing Kanban & Stage Tracker — FSM" sub="Stages advance strictly one step (FSM). Illegal skips are rejected by the API with an error toast.">
      <div className="flex gap-3 overflow-x-auto pb-2">{STAGES.map((s) => (
        <div key={s} className="min-w-[190px] w-[190px] bg-stone-50 rounded-xl border border-stone-200 p-2">
          <div className="text-xs font-bold uppercase text-stone-600 mb-2">{s.replace(/_/g, ' ')}</div>
          {lots.filter((l: any) => l.current_stage === s).map((l: any) => (
            <div key={l.id} className="bg-white rounded-lg border border-stone-200 p-2 mb-2 shadow-sm">
              <div className="font-semibold text-sm">{l.lot_code}</div>
              <div className="text-xs text-stone-500">{l.process_type} · {l.current_weight_kg} kg</div>
              <div className="flex gap-1 mt-2">
                <button className="btn !px-2 !py-1 text-xs" onClick={() => advance.mutate(l)}>Advance ▶</button>
                <select className="inp !w-auto !py-1 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) moveTo.mutate({ lot: l, stage: e.target.value }); e.target.value = '' }}>
                  <option value="">Move to…</option>{STAGES.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>))}
        </div>))}
      </div>
    </Section>
    <HandoverForm lots={lots} />
  </div>)
}
function HandoverForm({ lots }: { lots: any[] }) {
  const beds = useList('/drying-beds/'); const readings = useList('/moisture-readings/'); const handovers = useList('/drying-handovers/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ lot: '', bed: '', station: '', site_name: 'Murago', final_moisture_pct: 11, dried_coffee_kg: 0, storage_date: new Date().toISOString().slice(0, 10), issued_by: '', received_by: '', issued_pin: '', received_pin: '' })
  const submit = useMutation({
    mutationFn: async () => {
      const h = await post('/drying-handovers/', { lot: f.lot, bed: f.bed, station: f.station, site_name: f.site_name, final_moisture_pct: f.final_moisture_pct, dried_coffee_kg: f.dried_coffee_kg, storage_date: f.storage_date, issued_by: f.issued_by, received_by: f.received_by })
      return post(`/drying-handovers/${h.id}/dual-sign/`, { issued_pin: f.issued_pin || null, received_pin: f.received_pin || null })
    },
    onSuccess: () => { toast('Handover recorded with dual sign-off (Issued By ≠ Received By)'); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false) })
  const warn = Number(f.final_moisture_pct) < 10.5 || Number(f.final_moisture_pct) > 11.5
  return (<Section title="Zenebe Genale / Murago Drying Bed & Storage Handover Form" sub="Moisture target 10.5%–11.5% · mandatory dual digital signatures with PIN pads">
    <div className="grid md:grid-cols-4 gap-2">
      <Field label="Lot"><select className="inp" value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })}><option value="">Select…</option>{lots.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
      <Field label="Bed No."><select className="inp" value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })}><option value="">Select…</option>{beds.rows.map((b: any) => <option key={b.id} value={b.id}>Bed {b.bed_no}</option>)}</select></Field>
      <Field label="Station"><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
      <Field label="Date of Storage"><input className="inp" type="date" value={f.storage_date} onChange={(e) => setF({ ...f, storage_date: e.target.value })} /></Field>
      <Field label="Final moisture %"><input className="inp" type="number" step="0.1" value={f.final_moisture_pct} onChange={(e) => setF({ ...f, final_moisture_pct: e.target.value })} /></Field>
      <Field label="Amount of Dried Coffee (kg)"><input className="inp" type="number" value={f.dried_coffee_kg} onChange={(e) => setF({ ...f, dried_coffee_kg: e.target.value })} /></Field>
      <Field label="Issued By (Purchaser/Station Officer)"><UserSelect value={f.issued_by} onChange={(v: string) => setF({ ...f, issued_by: v })} /></Field>
      <Field label="Issued PIN pad"><input className="inp" type="password" inputMode="numeric" value={f.issued_pin} onChange={(e) => setF({ ...f, issued_pin: e.target.value })} placeholder="••••" /></Field>
      <Field label="Received By (Industry Professional)"><UserSelect value={f.received_by} onChange={(v: string) => setF({ ...f, received_by: v })} /></Field>
      <Field label="Received PIN pad"><input className="inp" type="password" inputMode="numeric" value={f.received_pin} onChange={(e) => setF({ ...f, received_pin: e.target.value })} placeholder="••••" /></Field>
    </div>
    {warn && <p className="text-amber-700 text-xs mt-1">⚠ Moisture {f.final_moisture_pct}% is outside the 10.5%–11.5% target band.</p>}
    <button className="btn mt-2" onClick={() => submit.mutate()}>Record handover + dual sign</button>
    <div className="grid md:grid-cols-2 gap-4 mt-3"><div><h4 className="font-semibold text-sm">Moisture readings</h4><T rows={readings.rows} cols={[['reading_date', 'Date'], ['moisture_pct', 'Moisture %'], ['moisture_warning', 'Outside 10.5–11.5']]} /></div>
      <div><h4 className="font-semibold text-sm">Handovers</h4><T rows={handovers.rows} cols={[['storage_date', 'Storage date'], ['final_moisture_pct', 'Moisture %'], ['dried_coffee_kg', 'Dried kg']]} /></div></div>
  </Section>)
}

/* ---------------- 6. Dry Mill ---------------- */
function DryMill() {
  const wos = useList('/milling-work-orders/'); const outs = useList('/milling-outputs/'); const grading = useList('/grading-records/'); const screens = useList('/screen-distributions/')
  const lots = useList('/lots/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ order_number: '', mill_station: '', input_lot: '', scheduled_date: new Date().toISOString().slice(0, 10) })
  const create = useMutation({ mutationFn: () => post('/milling-work-orders/', f), onSuccess: () => { toast('Milling work order created'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Dry Mill Batch Processing Terminal — work orders & hulling mass-balance">
      <div className="grid md:grid-cols-4 gap-2"><Field label="Order #"><input className="inp" value={f.order_number} onChange={(e) => setF({ ...f, order_number: e.target.value })} placeholder="MWO-2026-001" /></Field>
        <Field label="Mill station"><StationSelect value={f.mill_station} onChange={(v: string) => setF({ ...f, mill_station: v })} /></Field>
        <Field label="Input lot"><select className="inp" value={f.input_lot} onChange={(e) => setF({ ...f, input_lot: e.target.value })}><option value="">Select…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
        <Field label="Scheduled"><input className="inp" type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></Field></div>
      <button className="btn mt-2" onClick={() => create.mutate()}>Create work order</button>
      <T rows={wos.rows} cols={[['order_number', 'Order'], ['status', 'Status'], ['scheduled_date', 'Scheduled']]} />
      <T rows={outs.rows} cols={[['input_kg', 'Input kg'], ['green_out_kg', 'Green out kg'], ['husk_kg', 'Husk kg'], ['loss_kg', 'Loss kg']]} />
    </Section>
    <Section title="Screen Sizing, Gravity & Color Sorting Log"><T rows={grading.rows} cols={[['graded_on', 'Date'], ['gravity_table_kg', 'Gravity kg'], ['color_sorted_kg', 'Color kg'], ['hand_picked_kg', 'Hand-picked kg'], ['rejects_kg', 'Rejects kg']]} />
      <T rows={screens.rows} cols={[['screen_size', 'Screen'], ['weight_kg', 'Weight kg']]} /></Section>
  </div>)
}

/* ---------------- 7. Traceability ---------------- */
function Traceability() {
  const lots = useList('/lots/'); const checks = useList('/commingling-checks/')
  const [lotId, setLotId] = useState('')
  const q = useQuery({ queryKey: ['trace', lotId], queryFn: () => api(`/lots/${lotId}/traceability/`), enabled: !!lotId })
  const nodes = q.data?.nodes ?? []; const edges = q.data?.edges ?? []
  const byId = useMemo(() => Object.fromEntries(nodes.map((n: any) => [n.id, n])), [nodes])
  return (<div>
    <Section title="Interactive Farm-to-Export Traceability Tree" sub="Forward & backward DAG lineage: Farmer GPS origin → Collection → Processing → Drying Bed → Dry Mill → Warehouse → Export">
      <Field label="Lot"><select className="inp max-w-md" value={lotId} onChange={(e) => setLotId(e.target.value)}><option value="">Select a lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code} [{l.current_stage}]</option>)}</select></Field>
      {q.data && (<div className="mt-3">
        <div className="flex flex-wrap gap-2">{nodes.map((n: any) => <div key={n.id} className={`rounded-lg border px-3 py-2 text-sm ${n.id === lotId ? 'border-amber-500 bg-amber-50 font-bold' : 'border-stone-200 bg-white'}`}>{n.lot_code}<div className="text-xs text-stone-500">{n.current_stage} · {n.current_weight_kg} kg</div></div>)}</div>
        <h4 className="font-semibold text-sm mt-3">Lineage edges (parent → child)</h4>
        {edges.length ? edges.map((e: any) => <div key={e.id} className="text-sm py-1 border-b border-stone-100">🌱 {byId[e.parent_lot]?.lot_code ?? e.parent_lot} <span className="text-stone-400">—{e.edge_type} {e.weight_kg} kg (ratio {e.ratio})→</span> {byId[e.child_lot]?.lot_code ?? e.child_lot}</div>) : <p className="text-sm text-stone-400">No split/blend edges for this lot yet — use the Lot Studio.</p>}
      </div>)}
    </Section>
    <Section title="Commingling Risk & Audit Monitor"><T rows={checks.rows} cols={[['checked_at', 'Checked'], ['location_label', 'Location'], ['certified_separation_ok', 'Separation OK'], ['result', 'Result']]} /></Section>
  </div>)
}

/* ---------------- 8. Lot & Batch Studio ---------------- */
function LotStudio() {
  const lots = useList('/lots/', 'lots'); const labels = useList('/lot-labels/')
  const toast = useToast(); const qc = useQueryClient()
  const [split, setSplit] = useState<any>({ parent: '', code: '', weight: '' })
  const [blend, setBlend] = useState<any>({ code: '', a: '', aw: '', b: '', bw: '' })
  const doSplit = useMutation({ mutationFn: () => post(`/lots/${split.parent}/split/`, { splits: [{ lot_code: split.code, weight_kg: split.weight }] }), onSuccess: (d: any) => { toast(`Split done: ${JSON.stringify(d.edges)}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const doBlend = useMutation({ mutationFn: () => post('/lots/blend/', { child: { lot_code: blend.code }, contributions: [{ lot_id: blend.a, weight_kg: blend.aw }, { lot_id: blend.b, weight_kg: blend.bw }] }), onSuccess: (d: any) => { toast(`Blend created: ${d.child} = ${d.weight_kg} kg`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const lotSelect = (v: string, set: (x: string) => void) => <select className="inp" value={v} onChange={(e) => set(e.target.value)}><option value="">Select lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code} ({l.current_weight_kg} kg)</option>)}</select>
  return (<div>
    <Section title="Lot Creation, Splitting & Blending Studio" sub="Parent-child weight ratios preserved by the DAG engine; over-draw is rejected">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-stone-200 rounded-xl p-3"><h4 className="font-semibold text-sm mb-2">Split a lot</h4>
          <Field label="Parent lot">{lotSelect(split.parent, (v) => setSplit({ ...split, parent: v }))}</Field>
          <div className="grid grid-cols-2 gap-2 mt-2"><Field label="Child lot code"><input className="inp" value={split.code} onChange={(e) => setSplit({ ...split, code: e.target.value })} placeholder="MUR-…-W-001-A" /></Field>
            <Field label="Weight (kg)"><input className="inp" type="number" value={split.weight} onChange={(e) => setSplit({ ...split, weight: e.target.value })} /></Field></div>
          <button className="btn mt-2" onClick={() => doSplit.mutate()}>Split lot</button></div>
        <div className="border border-stone-200 rounded-xl p-3"><h4 className="font-semibold text-sm mb-2">Blend lots</h4>
          <Field label="Parent A">{lotSelect(blend.a, (v) => setBlend({ ...blend, a: v }))}</Field>
          <div className="grid grid-cols-2 gap-2 mt-2"><Field label="A weight (kg)"><input className="inp" type="number" value={blend.aw} onChange={(e) => setBlend({ ...blend, aw: e.target.value })} /></Field>
            <Field label="New lot code"><input className="inp" value={blend.code} onChange={(e) => setBlend({ ...blend, code: e.target.value })} placeholder="MUR-…-BLEND-01" /></Field></div>
          <div className="mt-2"><Field label="Parent B">{lotSelect(blend.b, (v) => setBlend({ ...blend, b: v }))}</Field></div>
          <div className="mt-2"><Field label="B weight (kg)"><input className="inp" type="number" value={blend.bw} onChange={(e) => setBlend({ ...blend, bw: e.target.value })} /></Field></div>
          <button className="btn mt-2" onClick={() => doBlend.mutate()}>Blend lots</button></div>
      </div>
    </Section>
    <Section title="Lot Barcode/QR Print Queue"><T rows={labels.rows} cols={[['qr_payload', 'QR payload'], ['net_weight_kg', 'Net kg'], ['status', 'Status']]} /></Section>
  </div>)
}

/* ---------------- 9. Quality ---------------- */
const CUP_FIELDS = ['fragrance_aroma', 'flavour', 'aftertaste', 'acidity', 'body', 'balance', 'uniformity', 'clean_cup', 'sweetness', 'overall'] as const
function Quality() {
  const physical = useList('/physical-analyses/'); const cuppings = useList('/cupping-scores/'); const approvals = useList('/quality-approvals/')
  const lots = useList('/lots/')
  const toast = useToast(); const qc = useQueryClient()
  const [cup, setCup] = useState<any>({ lot: '', cupped_on: new Date().toISOString().slice(0, 10), fragrance_aroma: 8, flavour: 8, aftertaste: 8, acidity: 8, body: 8, balance: 8, uniformity: 10, clean_cup: 10, sweetness: 10, overall: 8 })
  const radarData = CUP_FIELDS.map((f) => ({ axis: f.replace(/_/g, ' '), score: Number(cup[f]) || 0 }))
  const saveCup = useMutation({ mutationFn: () => post('/cupping-scores/', cup), onSuccess: () => { toast('Cupping scorecard saved'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const decide = useMutation({ mutationFn: ({ id, decision }: any) => post(`/cupping-scores/${id}/decide/`, { decision, grade: '1', remarks: decision === 'approved' ? 'Released for export' : 'Rejected at cupping' }), onSuccess: () => { toast('Quality decision recorded'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Lab Physical Inspection Worksheet"><T rows={physical.rows} cols={[['analysed_on', 'Date'], ['moisture_pct', 'Moisture %'], ['moisture_warning', '⚠ outside 10.5–11.5'], ['water_activity', 'a_w'], ['bean_density', 'Density'], ['colour', 'Colour'], ['primary_defects', 'Primary defects'], ['secondary_defects', 'Secondary defects']]} /></Section>
    <Section title="Q-Grader Cupping Scorecard & Lot Approval" sub="Spider chart preview updates as you score (0–10 per attribute)">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Field label="Lot"><select className="inp" value={cup.lot} onChange={(e) => setCup({ ...cup, lot: e.target.value })}><option value="">Select…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-2 mt-2">{CUP_FIELDS.map((f) => <Field key={f} label={f.replace(/_/g, ' ')}><input className="inp" type="number" step="0.25" min="0" max="10" value={cup[f]} onChange={(e) => setCup({ ...cup, [f]: e.target.value })} /></Field>)}</div>
          <button className="btn mt-3" onClick={() => saveCup.mutate()}>Save scorecard</button></div>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }} /><Radar dataKey="score" stroke="#d97706" fill="#f59e0b" fillOpacity={0.5} /><Tooltip /></RadarChart></ResponsiveContainer></div>
      </div>
      <div className="mt-3">{cuppings.rows.map((c: any) => <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-stone-100 text-sm"><span className="font-medium">{c.cupped_on}</span><span>Total: <b>{c.total_score}</b></span>
        <button className="btn !py-1 text-xs" onClick={() => decide.mutate({ id: c.id, decision: 'approved' })}>Approve for export (Grade 1)</button>
        <button className="btn-ghost !py-1 text-xs" onClick={() => decide.mutate({ id: c.id, decision: 'rejected' })}>Reject</button></div>)}</div>
      <h4 className="font-semibold text-sm mt-3">Quality approvals</h4><T rows={approvals.rows} cols={[['grade', 'Grade'], ['decision', 'Decision'], ['decided_at', 'Decided'], ['remarks', 'Remarks']]} />
    </Section></div>)
}

/* ---------------- 10. Warehouse ---------------- */
function Warehouse() {
  const stores = useList('/stores/'); const bins = useList('/bins/'); const transfers = useList('/stock-transfers/'); const passes = useList('/gate-passes/'); const receipts = useList('/stock-receipts/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ issued_by: '', received_by: '', received_kg: '' })
  const [tid, setTid] = useState('')
  const sign = useMutation({ mutationFn: () => post(`/stock-transfers/${tid}/dual-sign/`, { issued_by: f.issued_by, received_by: f.received_by, received_kg: f.received_kg || null }), onSuccess: (d: any) => { toast(`Transfer dual-signed · status ${d.status} · shrinkage ${d.shrinkage_kg ?? '—'} kg`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Warehouse Bin Map & Anti-Commingling Grid" sub="Segregated stores: parchment / natural cherry / milled green">
      <div className="grid md:grid-cols-3 gap-3">{stores.rows.map((s: any) => (<div key={s.id} className="border border-stone-200 rounded-xl p-3"><div className="font-bold">{s.code} — {s.name}</div><div className="text-xs text-stone-500 mb-2">Form: {s.coffee_form}</div>
        <div className="grid grid-cols-3 gap-1">{bins.rows.filter((b: any) => b.store === s.id).map((b: any) => <div key={b.id} className={`rounded-lg text-center text-xs py-2 ${b.certified_only ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100'}`}>{b.bin_code}<div>{b.capacity_kg} kg{b.certified_only ? ' · certified only' : ''}</div></div>)}</div></div>))}
      </div>
      {bins.rows.length > 0 && !stores.rows.length && <T rows={bins.rows} cols={[['bin_code', 'Bin'], ['capacity_kg', 'Capacity kg'], ['certified_only', 'Certified only']]} />}
    </Section>
    <Section title="Inter-Store Transfer & Gate Pass Manager" sub="Dual-signed receipts · dispatch vs received out-turn shrinkage">
      <T rows={receipts.rows} cols={[['receipt_number', 'Receipt'], ['received_date', 'Date'], ['weight_kg', 'Weight kg'], ['bags', 'Bags']]} />
      <T rows={transfers.rows} cols={[['transfer_number', 'Transfer'], ['dispatched_kg', 'Dispatched kg'], ['received_kg', 'Received kg'], ['status', 'Status']]} />
      <div className="grid md:grid-cols-4 gap-2 mt-3">
        <Field label="Transfer"><select className="inp" value={tid} onChange={(e) => setTid(e.target.value)}><option value="">Select…</option>{transfers.rows.map((t: any) => <option key={t.id} value={t.id}>{t.transfer_number}</option>)}</select></Field>
        <Field label="Issued By"><UserSelect value={f.issued_by} onChange={(v: string) => setF({ ...f, issued_by: v })} /></Field>
        <Field label="Received By"><UserSelect value={f.received_by} onChange={(v: string) => setF({ ...f, received_by: v })} /></Field>
        <Field label="Received kg (out-turn)"><input className="inp" type="number" value={f.received_kg} onChange={(e) => setF({ ...f, received_kg: e.target.value })} /></Field>
      </div><button className="btn mt-2" onClick={() => sign.mutate()}>Dual-sign transfer</button>
      <h4 className="font-semibold text-sm mt-3">Gate passes</h4><T rows={passes.rows} cols={[['pass_number', 'Pass'], ['vehicle_plate', 'Plate'], ['weight_kg', 'Weight kg'], ['issued_at', 'Issued']]} />
    </Section></div>)
}

/* ---------------- 11. Resources: Fuel & Water ---------------- */
function Resources() {
  const fuel = useList('/fuel-entries/'); const water = useList('/water-entries/')
  const toast = useToast(); const qc = useQueryClient()
  const [ff, setFf] = useState<any>({ station: '', entry_date: new Date().toISOString().slice(0, 10), machine_label: 'Generator 1', fuel_purchased_litres: 0, fuel_added_litres: 0, cherry_pulped_kg: 0 })
  const [wf, setWf] = useState<any>({ station: '', entry_date: new Date().toISOString().slice(0, 10), meter_reading_litres: 0, previous_reading_litres: 0, previous_day_pulped_kg: 0, recycled_litres: 0 })
  const fuelLocal = (Number(ff.cherry_pulped_kg) > 0) ? (Number(ff.fuel_added_litres) / Number(ff.cherry_pulped_kg)).toFixed(5) : '—'
  const waterLocal = (Number(wf.previous_day_pulped_kg) > 0) ? ((Number(wf.meter_reading_litres) - Number(wf.previous_reading_litres)) / Number(wf.previous_day_pulped_kg)).toFixed(5) : '—'
  const saveFuel = useMutation({ mutationFn: () => post('/fuel-entries/', ff), onSuccess: (d: any) => { toast(`Fuel saved · ratio ${d.fuel_ratio} L/kg ${d.is_anomaly ? '⚠ ANOMALY' : ''}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const saveWater = useMutation({ mutationFn: () => post('/water-entries/', wf), onSuccess: (d: any) => { toast(`Water saved · consumption ${d.consumption_litres} L · ratio ${d.water_ratio} L/prev-day-kg ${d.is_anomaly ? '⚠ ANOMALY' : ''}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Daily Fuel Consumption Register — የነዳጅ ፍጆታ መከታተያ ቅጽ" sub="Ratio auto-calculated by the API: litres ÷ kg pulped cherry that day">
      <div className="grid md:grid-cols-6 gap-2"><Field label="Station"><StationSelect value={ff.station} onChange={(v: string) => setFf({ ...ff, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={ff.entry_date} onChange={(e) => setFf({ ...ff, entry_date: e.target.value })} /></Field>
        <Field label="Machine"><input className="inp" value={ff.machine_label} onChange={(e) => setFf({ ...ff, machine_label: e.target.value })} /></Field>
        <Field label="Fuel purchased (L)"><input className="inp" type="number" value={ff.fuel_purchased_litres} onChange={(e) => setFf({ ...ff, fuel_purchased_litres: e.target.value })} /></Field>
        <Field label="Fuel added (L)"><input className="inp" type="number" value={ff.fuel_added_litres} onChange={(e) => setFf({ ...ff, fuel_added_litres: e.target.value })} /></Field>
        <Field label="Cherry pulped (kg)"><input className="inp" type="number" value={ff.cherry_pulped_kg} onChange={(e) => setFf({ ...ff, cherry_pulped_kg: e.target.value })} /></Field></div>
      <div className="flex gap-4 items-center mt-2 text-sm"><span>Live ratio: <b>{fuelLocal} L/kg</b></span><button className="btn" onClick={() => saveFuel.mutate()}>Save fuel entry</button></div>
      <T rows={fuel.rows} cols={[['entry_date', 'Date'], ['machine_label', 'Machine'], ['fuel_added_litres', 'Added L'], ['cherry_pulped_kg', 'Pulped kg'], ['fuel_ratio', 'Fuel ratio L/kg'], ['is_anomaly', 'Anomaly']]} />
    </Section>
    <Section title="Daily Water Consumption Register — የውሃ ፍጆታ መከታተያ ቅጽ" sub="Midday (12:00 PM / 6:00 local) meter reading · ratio = consumption ÷ PREVIOUS day's pulped kg">
      <div className="grid md:grid-cols-6 gap-2"><Field label="Station"><StationSelect value={wf.station} onChange={(v: string) => setWf({ ...wf, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={wf.entry_date} onChange={(e) => setWf({ ...wf, entry_date: e.target.value })} /></Field>
        <Field label="Meter reading (L)"><input className="inp" type="number" value={wf.meter_reading_litres} onChange={(e) => setWf({ ...wf, meter_reading_litres: e.target.value })} /></Field>
        <Field label="Previous reading (L)"><input className="inp" type="number" value={wf.previous_reading_litres} onChange={(e) => setWf({ ...wf, previous_reading_litres: e.target.value })} /></Field>
        <Field label="Prev-day pulped (kg)"><input className="inp" type="number" value={wf.previous_day_pulped_kg} onChange={(e) => setWf({ ...wf, previous_day_pulped_kg: e.target.value })} /></Field>
        <Field label="Recycled (L)"><input className="inp" type="number" value={wf.recycled_litres} onChange={(e) => setWf({ ...wf, recycled_litres: e.target.value })} /></Field></div>
      <div className="flex gap-4 items-center mt-2 text-sm"><span>Live ratio: <b>{waterLocal} L/prev-kg</b></span><button className="btn" onClick={() => saveWater.mutate()}>Save water entry</button></div>
      <T rows={water.rows} cols={[['entry_date', 'Date'], ['consumption_litres', 'Consumption L'], ['previous_day_pulped_kg', 'Prev-day kg'], ['water_ratio', 'Water ratio'], ['is_anomaly', 'Anomaly'], ['lagoon_level_pct', 'Lagoon %']]} />
    </Section></div>)
}

/* ---------------- 12. HR & 30-Day Attendance (AG Grid) ---------------- */
function HR() {
  const workers = useList('/workers/', 'workers'); const sheets = useList('/attendance-sheets/'); const entries = useList('/attendance-entries/')
  const toast = useToast(); const qc = useQueryClient()
  const [sheetId, setSheetId] = useState('')
  const [newSheet, setNewSheet] = useState<any>({ station: '', ethiopian_month: 2, ethiopian_year: 2018 })
  const [verify, setVerify] = useState<any>({ controlled_by: '', verified_by: '', controlled_pin: '', verified_pin: '' })
  const rowData = useMemo(() => workers.rows.map((w: any) => {
    const row: any = { worker_id: w.id, worker_code: w.worker_code, full_name: w.full_name }
    for (let d = 1; d <= 30; d++) row[`d${d}`] = ''
    entries.rows.filter((e: any) => e.sheet === sheetId && e.worker === w.id).forEach((e: any) => { row[`d${e.day}`] = e.mark === 'present' ? '✓' : e.mark === 'half' ? '½' : e.mark === 'absent' ? '✗' : 'L' })
    return row
  }), [workers.rows, entries.rows, sheetId])
  const colDefs = useMemo(() => [
    { field: 'worker_code', headerName: 'ተ.ቁ ID', pinned: 'left' as const, width: 90 },
    { field: 'full_name', headerName: 'የሠራተኛው ስም Name', pinned: 'left' as const, width: 160 },
    ...Array.from({ length: 30 }, (_, i) => ({ field: `d${i + 1}`, headerName: String(i + 1), width: 52, editable: true })),
  ], [])
  const saveGrid = useMutation({
    mutationFn: async (rows: any[]) => {
      if (!sheetId) throw new Error('Select an attendance sheet first')
      let n = 0
      for (const r of rows) for (let d = 1; d <= 30; d++) {
        const v = String(r[`d${d}`] ?? '').trim(); if (!v) continue
        const mark = v === '✓' || v === '1' ? 'present' : v === '½' ? 'half' : v === '✗' || v === '0' ? 'absent' : 'leave'
        await post('/attendance-entries/', { sheet: sheetId, worker: r.worker_id, day: d, mark, hours: mark === 'present' ? 8 : mark === 'half' ? 4 : 0, pieces: 0 }); n++
      }
      return n
    },
    onSuccess: (n: number) => { toast(`${n} attendance cells saved`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const gridRef = useRef<any>(null)
  const createSheet = useMutation({ mutationFn: () => post('/attendance-sheets/', newSheet), onSuccess: (d: any) => { toast('Attendance sheet created'); setSheetId(d.id); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const doVerify = useMutation({ mutationFn: () => post(`/attendance-sheets/${sheetId}/verify/`, { controlled_by: verify.controlled_by, verified_by: verify.verified_by, controlled_pin: verify.controlled_pin || null, verified_pin: verify.verified_pin || null }), onSuccess: () => { toast('Sheet dual-verified: Controlled By + Verified By (payroll-ready)'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Casual Labor & Operator Onboarding — Seasonal Worker Registry"><T rows={workers.rows} cols={[['worker_code', 'Worker ID ተ.ቁ'], ['full_name', 'Name'], ['kind', 'Kind'], ['wage_type', 'Wage type'], ['wage_rate', 'Rate ETB'], ['is_active', 'Active']]} /></Section>
    <Section title="30-Day Worker Attendance Grid — የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ" sub="AG Grid Community · inline editing (✓ present, ½ half, ✗ absent, L leave) · ወር / ዓ.ም Ethiopian month/year · locked by dual signatures">
      <div className="grid md:grid-cols-5 gap-2 mb-3">
        <Field label="Sheet (ወር / ዓ.ም)"><select className="inp" value={sheetId} onChange={(e) => setSheetId(e.target.value)}><option value="">Select sheet…</option>{sheets.rows.map((s: any) => <option key={s.id} value={s.id}>{s.ethiopian_month} / {s.ethiopian_year} — {s.status}</option>)}</select></Field>
        <Field label="New sheet station"><StationSelect value={newSheet.station} onChange={(v: string) => setNewSheet({ ...newSheet, station: v })} /></Field>
        <Field label="ወር Month"><input className="inp" type="number" value={newSheet.ethiopian_month} onChange={(e) => setNewSheet({ ...newSheet, ethiopian_month: Number(e.target.value) })} /></Field>
        <Field label="ዓ.ም Year"><input className="inp" type="number" value={newSheet.ethiopian_year} onChange={(e) => setNewSheet({ ...newSheet, ethiopian_year: Number(e.target.value) })} /></Field>
        <div className="flex items-end"><button className="btn-ghost w-full justify-center" onClick={() => createSheet.mutate()}>+ New sheet</button></div>
      </div>
      <div className="ag-theme-quartz" style={{ height: 340, width: '100%' }}>
        <AgGridReact ref={gridRef} rowData={rowData} columnDefs={colDefs as any} defaultColDef={{ sortable: false, resizable: true }} />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn" onClick={() => { const rows: any[] = []; gridRef.current?.api?.forEachNode((n: any) => rows.push(n.data)); saveGrid.mutate(rows) }}>Save grid entries</button>
      </div>
      <div className="grid md:grid-cols-4 gap-2 mt-4">
        <Field label="Controlled By — የተቆጣጠረው ስምና ፊርማ"><UserSelect value={verify.controlled_by} onChange={(v: string) => setVerify({ ...verify, controlled_by: v })} /></Field>
        <Field label="Controlled PIN"><input className="inp" type="password" value={verify.controlled_pin} onChange={(e) => setVerify({ ...verify, controlled_pin: e.target.value })} /></Field>
        <Field label="Verified By — ያረጋገጠው ስምና ፊርማ"><UserSelect value={verify.verified_by} onChange={(v: string) => setVerify({ ...verify, verified_by: v })} /></Field>
        <Field label="Verified PIN"><input className="inp" type="password" value={verify.verified_pin} onChange={(e) => setVerify({ ...verify, verified_pin: e.target.value })} /></Field>
      </div>
      <button className="btn-dark mt-2" onClick={() => doVerify.mutate()}>Dual-verify sheet (Controlled + Verified)</button>
    </Section></div>)
}

/* ---------------- 13. Payroll ---------------- */
function Payroll() {
  const periods = useList('/payroll-periods/'); const lines = useList('/payroll-lines/'); const sheets = useList('/attendance-sheets/')
  const toast = useToast(); const qc = useQueryClient()
  const [sheetId, setSheetId] = useState('')
  const gen = useMutation({ mutationFn: () => post(`/attendance-sheets/${sheetId}/generate-payroll/`, {}), onSuccess: (d: any) => { toast(`Payroll generated · gross ${d.total_gross} · net ${d.total_net} ETB`); qc.invalidateQueries() }, onError: (e: any) => toast(`Payroll blocked: ${errMsg(e)}`, false) })
  const approve = useMutation({ mutationFn: (id: string) => post(`/payroll-periods/${id}/approve/`, {}), onSuccess: () => { toast('Payroll approved (Prepared ≠ Approved enforced)'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const signLine = useMutation({ mutationFn: (id: string) => post(`/payroll-lines/${id}/sign-recipient/`, { signature: 'tablet-signature' }), onSuccess: () => { toast('Recipient signed'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    <Section title="Daily Worker Payroll Sheet — የቀን ሠራተኞች መክፈያ ፔሮል" sub="Auto-aggregated from the DUAL-VERIFIED 30-day grid · generation is blocked without both signatures">
      <div className="flex flex-wrap gap-2 items-end"><div className="w-64"><Field label="Verified attendance sheet"><select className="inp" value={sheetId} onChange={(e) => setSheetId(e.target.value)}><option value="">Select sheet…</option>{sheets.rows.map((s: any) => <option key={s.id} value={s.id}>{s.ethiopian_month}/{s.ethiopian_year} — {s.status}</option>)}</select></Field></div>
        <button className="btn" onClick={() => gen.mutate()}>Generate payroll from grid</button></div>
      {periods.rows.map((p: any) => <div key={p.id} className="flex flex-wrap gap-3 items-center py-2 border-b border-stone-100 text-sm"><span>Status: <b>{p.status}</b></span><span>ጠቅላላ ክፍያ Gross: <b>{p.total_gross}</b></span><span>ተቆራጭ Deductions: <b>{p.total_deductions}</b></span><span>የተጣራ ክፍያ Net: <b>{p.total_net}</b></span>
        {p.status === 'prepared' && <button className="btn !py-1 text-xs" onClick={() => approve.mutate(p.id)}>Approve (ያፀደቀው)</button>}</div>)}
    </Section>
    <Section title="Payroll Authorization & Payout Sign-Off Sheet" sub="Prepared By ያዘጋጀው · Approved By ያፀደቀው · recipient signature column የተቀባይ ስምና ፊርማ">
      <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['#', 'Worker', 'Days', 'Hours', 'Pieces', 'ጠቅላላ ክፍያ Gross', 'ተቆራጭ Deductions', 'የተጣራ ክፍያ Net', 'የተቀባይ ስምና ፊርማ Recipient'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody>{lines.rows.map((l: any) => <tr key={l.id}><td className="td">{l.row_no}</td><td className="td">{l.worker}</td><td className="td">{l.total_days}</td><td className="td">{l.total_hours}</td><td className="td">{l.total_pieces}</td><td className="td">{l.gross_pay}</td><td className="td">{l.deductions}</td><td className="td font-semibold">{l.net_pay}</td>
          <td className="td">{l.recipient_signed ? '✍ Signed' : <button className="btn-ghost !py-0.5 text-xs" onClick={() => signLine.mutate(l.id)}>Sign on tablet</button>}</td></tr>)}</tbody></table></div>
    </Section></div>)
}

/* ---------------- 14. Buyers & Contracts ---------------- */
function Buyers() {
  const buyers = useList('/buyers/'); const contracts = useList('/sales-contracts/'); const allocs = useList('/contract-allocations/'); const pss = useList('/sample-feedback/')
  return (<div>
    <Section title="Buyer Directory & Sample Feedback Log — International Buyer CRM"><T rows={buyers.rows} cols={[['code', 'Code'], ['company_name', 'Buyer'], ['country', 'Country'], ['contact_name', 'Contact'], ['preferred_incoterm', 'Incoterm']]} />
      <T rows={pss.rows} cols={[['sample_code', 'PSS sample'], ['sent_on', 'Sent'], ['status', 'PSS status'], ['feedback', 'Feedback']]} /></Section>
    <Section title="Sales Contract & Price Fixation Ledger" sub="Outright price or ICE 'C' differential · lot allocation locks enforced by the API">
      <T rows={contracts.rows} cols={[['contract_number', 'Contract'], ['grade', 'Grade'], ['quantity_mt', 'MT'], ['quantity_bags', 'Bags'], ['pricing_basis', 'Pricing'], ['outright_price', 'Outright'], ['ice_differential', 'ICE diff'], ['incoterm', 'Incoterm'], ['currency', 'Ccy'], ['status', 'Status']]} />
      <h4 className="font-semibold text-sm mt-2">Lot allocations</h4><T rows={allocs.rows} cols={[['allocated_kg', 'Allocated kg'], ['allocated_bags', 'Bags'], ['is_locked', 'Locked 🔒']]} /></Section>
  </div>)
}

/* ---------------- 15. Export ---------------- */
function ExportPage() {
  const markings = useList('/bag-markings/'); const packing = useList('/packing-records/'); const containers = useList('/containers/'); const docs = useList('/export-documents/')
  const sel = markings.rows[0]
  return (<div>
    <Section title="Export Bagging & Stencil Generator (Steps 7 & 8)" sub="ICO markings + buyer stencils for 60 kg jute bags / GrainPro liners">
      <T rows={markings.rows} cols={[['ico_mark', 'ICO mark'], ['buyer_stencil', 'Buyer stencil'], ['bag_type', 'Bag type'], ['crop_year', 'Crop']]} />
      {sel && <div className="mt-3 bg-stone-900 text-amber-400 rounded-xl p-5 font-mono text-center"><div className="text-2xl tracking-widest">{sel.ico_mark}</div><div className="text-lg mt-1">{sel.buyer_stencil}</div><div className="text-xs text-stone-400 mt-1">Stencil preview — {sel.bag_type} · crop {sel.crop_year}</div></div>}
      <T rows={packing.rows} cols={[['packed_on', 'Packed'], ['bags_packed', 'Bags'], ['gross_kg', 'Gross kg'], ['net_kg', 'Net kg']]} />
    </Section>
    <Section title="Container Loading & Customs Documentation Suite (Step 10)">
      <T rows={containers.rows} cols={[['container_number', 'Container'], ['seal_number', 'Seal'], ['total_bags', 'Bags'], ['total_net_kg', 'Net kg'], ['stuffed_on', 'Stuffed'], ['status', 'Status']]} />
      <T rows={docs.rows} cols={[['doc_type', 'Document'], ['document_number', 'Doc #'], ['status', 'Status']]} />
      <p className="text-xs text-stone-500">Generated document types: Commercial Invoice · Packing List · ICO Certificate of Origin · ECTA clearance · Phytosanitary certificate · EUDR GeoJSON dossier (payloads stored on each ExportDocument).</p>
    </Section></div>)
}

/* ---------------- 16. Logistics ---------------- */
function Logistics() {
  const transporters = useList('/transporters/'); const vehicles = useList('/vehicles/'); const waybills = useList('/waybills/'); const checkpoints = useList('/transit-checkpoints/')
  return (<div>
    <Section title="Vehicle Assignment & Waybill Generator"><T rows={transporters.rows} cols={[['code', 'Code'], ['company_name', 'Transporter'], ['phone', 'Phone']]} />
      <T rows={vehicles.rows} cols={[['plate_number', 'Plate'], ['vehicle_type', 'Type'], ['capacity_kg', 'Capacity kg'], ['driver_name', 'Driver']]} />
      <T rows={waybills.rows} cols={[['waybill_number', 'Waybill'], ['dispatched_kg', 'Dispatched kg'], ['delivered_kg', 'Delivered kg'], ['status', 'Status']]} /></Section>
    <Section title="Station-to-Addis & Djibouti Port Transit Monitor" sub="Checkpoint arrivals · receiving vs dispatch weight shrinkage">
      <T rows={checkpoints.rows} cols={[['kind', 'Checkpoint'], ['location_label', 'Location'], ['arrived_at', 'Arrived'], ['verified_weight_kg', 'Verified kg']]} />
      {waybills.rows.map((w: any) => w.delivered_kg ? <p key={w.id} className="text-sm py-1">{w.waybill_number}: shrinkage <b>{(Number(w.dispatched_kg) - Number(w.delivered_kg)).toFixed(2)} kg</b></p> : null)}
    </Section></div>)
}

/* ---------------- 17. Finance ---------------- */
function Finance() {
  const accounts = useList('/accounts/'); const journals = useList('/journal-entries/'); const lines = useList('/journal-lines/'); const arap = useList('/receivables-payables/'); const allocs = useList('/lot-cost-allocations/')
  const lots = useList('/lots/'); const [lotId, setLotId] = useState('')
  const cost = useQuery({ queryKey: ['cost', lotId], queryFn: () => api(`/lot-costing/${lotId}/`), enabled: !!lotId })
  return (<div>
    <Section title="Chart of Accounts, Journals & AR/AP Ledger — multi-currency double-entry (ETB / USD / EUR)">
      <T rows={accounts.rows} cols={[['code', 'Code'], ['name', 'Account'], ['account_type', 'Type'], ['currency', 'Ccy']]} />
      <T rows={journals.rows} cols={[['entry_number', 'Entry'], ['entry_date', 'Date'], ['description', 'Description'], ['status', 'Status']]} />
      <T rows={lines.rows} cols={[['debit', 'Debit'], ['credit', 'Credit'], ['currency', 'Ccy'], ['exchange_rate', 'FX'], ['memo', 'Memo']]} />
      <h4 className="font-semibold text-sm mt-2">AR / AP</h4><T rows={arap.rows} cols={[['kind', 'Kind'], ['reference', 'Ref'], ['amount', 'Amount'], ['amount_settled', 'Settled'], ['currency', 'Ccy'], ['due_on', 'Due'], ['status', 'Status']]} />
    </Section>
    <Section title="Landed Cost & Lot Profitability Analyzer — activity-based lot costing">
      <Field label="Lot"><select className="inp max-w-md" value={lotId} onChange={(e) => setLotId(e.target.value)}><option value="">Select lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
      {cost.data && <p className="text-sm mt-2">Landed cost for <b>{cost.data.lot}</b>: <b>{cost.data.landed_cost_per_kg ?? '—'} / kg</b> across {cost.data.allocations.length} allocations</p>}
      <T rows={allocs.rows} cols={[['component', 'Cost component'], ['amount', 'Amount'], ['currency', 'Ccy'], ['allocated_on', 'Date'], ['source_reference', 'Source ref']]} />
    </Section></div>)
}

/* ---------------- 18. Payments ---------------- */
function Payments() {
  const disb = useList('/disbursements/'); const proceeds = useList('/export-proceeds/'); const forex = useList('/forex-retentions/')
  return (<div>
    <Section title="Outgoing Payment Processing Center — field, supplier & worker disbursements"><T rows={disb.rows} cols={[['reference', 'Ref'], ['payee_type', 'Payee'], ['amount', 'Amount'], ['currency', 'Ccy'], ['method', 'Method'], ['paid_on', 'Paid'], ['status', 'Status']]} /></Section>
    <Section title="Buyer Settlement & LC/CAD Reconciliation — SWIFT receipts & NBE forex retention">
      <T rows={proceeds.rows} cols={[['settlement_type', 'Settlement'], ['swift_reference', 'SWIFT ref'], ['amount_usd', 'USD'], ['received_on', 'Received'], ['bank_name', 'Bank'], ['is_reconciled', 'Reconciled']]} />
      <T rows={forex.rows} cols={[['retention_pct', 'Retention %'], ['retained_usd', 'Retained USD'], ['surrendered_usd', 'Surrendered USD'], ['etb_credited', 'ETB credited'], ['exchange_rate', 'FX rate']]} /></Section>
  </div>)
}

/* ---------------- 19. Inventory ---------------- */
function Inventory() {
  const items = useList('/inventory-items/'); const moves = useList('/stock-movements/'); const audits = useList('/stock-audits/'); const adj = useList('/stock-adjustments/')
  return (<div>
    <Section title="Packaging Material, Fuel Drum & Spare Parts Ledger" sub="Jute bags · GrainPro liners · drying bed mesh · twine · bulk diesel — reorder alerts at reorder level">
      <T rows={items.rows} cols={[['sku', 'SKU'], ['name', 'Item'], ['category', 'Category'], ['unit', 'Unit'], ['reorder_level', 'Reorder level']]} />
      <T rows={moves.rows} cols={[['movement_date', 'Date'], ['movement_type', 'Type'], ['delta_qty', 'Delta'], ['reference', 'Ref']]} /></Section>
    <Section title="Stock Reconciliation & Adjustment Worksheet"><T rows={audits.rows} cols={[['audit_number', 'Audit'], ['audit_date', 'Date'], ['status', 'Status']]} />
      <T rows={adj.rows} cols={[['book_qty', 'Book qty'], ['counted_qty', 'Counted qty'], ['variance_reason', 'Variance reason']]} /></Section>
  </div>)
}

/* ---------------- 20. BI Reports ---------------- */
function BI() {
  const defs = useList('/report-definitions/'); const generated = useList('/generated-reports/')
  const [kind, setKind] = useState('procurement'); const [result, setResult] = useState<any>(null)
  const toast = useToast()
  const run = useMutation({ mutationFn: () => post('/reports/run/', { kind }), onSuccess: (d) => { setResult(d); toast(`Report '${kind}' generated`) }, onError: (e: any) => toast(errMsg(e), false) })
  const exportJson = () => { if (!result) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })); a.download = `murago-report-${kind}.json`; a.click() }
  return (<div>
    <Section title="Custom Report Builder & Regulatory Export Center" sub="Procurement volumes · conversion yields · fuel/water efficiency · grade distribution · stock aging · margins — for ECTA, EUDR auditors & board">
      <div className="flex flex-wrap gap-2 items-end"><div className="w-56"><Field label="Report kind"><select className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>{['procurement', 'yields', 'efficiency', 'quality', 'stock'].map((k) => <option key={k} value={k}>{k}</option>)}</select></Field></div>
        <button className="btn" onClick={() => run.mutate()}>Run report</button>
        <button className="btn-ghost" onClick={exportJson} disabled={!result}>Export (JSON download)</button></div>
      {result && <pre className="bg-stone-900 text-emerald-300 rounded-xl p-3 mt-3 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
      <T rows={defs.rows} cols={[['code', 'Code'], ['name', 'Report'], ['kind', 'Kind'], ['is_active', 'Active']]} />
      <T rows={generated.rows} cols={[['period_start', 'From'], ['period_end', 'To'], ['fmt', 'Format'], ['file_path', 'File']]} />
    </Section></div>)
}

/* ---------------- 21. Mobile Field App + Sync Manager ---------------- */
function MobileField() {
  const toast = useToast(); const qc = useQueryClient()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) } }, [])
  const [queue, setQueue] = useState<any[]>([])
  const refresh = async () => setQueue(await queuedRecords())
  useEffect(() => { refresh() }, [])
  const pull = useQuery({ queryKey: ['syncpull'], queryFn: () => api('/api/sync/pull/'), enabled: online })
  const capture = async (entity: string, payload: any) => {
    const rec = { client_uuid: uuidv7(), device_id: 'field-tablet-01', entity_type: entity, entity_uuid: uuidv7(), payload, client_created_at: new Date().toISOString() }
    await queueOffline(rec); await refresh(); toast('Captured OFFLINE — stored in IndexedDB sync queue')
    try { const reg: any = await navigator.serviceWorker?.ready; await reg?.sync?.register('murago-sync') } catch { /* ignore */ }
  }
  const syncNow = useMutation({
    mutationFn: async () => { const recs = await queuedRecords(); const res = await post('/sync/push/', { records: recs }); await clearQueued(recs.map((r: any) => r.client_uuid)); return res },
    onSuccess: (d: any) => { toast(`Sync complete: ${JSON.stringify(d.acks)}`); refresh(); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const [farmerName, setFarmerName] = useState(''); const [fuelL, setFuelL] = useState('')
  return (<div>
    <Section title="Offline Field Data Capture — Mobile Farmer, Polygon & Cherry Collection" sub="Touch-optimised · works with zero connectivity at rural washing stations · UUIDv7 client IDs">
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{online ? '🟢 Online' : '🔴 Offline — capturing to local queue'} · Queued: {queue.length}</div>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="border border-stone-200 rounded-xl p-3"><h4 className="font-semibold text-sm">Register farmer (offline)</h4>
          <Field label="Full name"><input className="inp" value={farmerName} onChange={(e) => setFarmerName(e.target.value)} /></Field>
          <button className="btn mt-2" onClick={() => capture('farmers.Farmer', { full_name: farmerName })}>Queue farmer registration</button>
          <p className="text-xs text-stone-500 mt-1">GPS polygon walk is captured as GeoJSON on the plot record (Farm GIS page).</p></div>
        <div className="border border-stone-200 rounded-xl p-3"><h4 className="font-semibold text-sm">Station operator log — fuel (offline)</h4>
          <Field label="Fuel added (litres)"><input className="inp" type="number" value={fuelL} onChange={(e) => setFuelL(e.target.value)} /></Field>
          <button className="btn mt-2" onClick={() => capture('resources.FuelRegisterEntry', { fuel_added_litres: fuelL })}>Queue fuel log</button>
          <p className="text-xs text-stone-500 mt-1">Water midday readings & drying-bed handovers queue the same way.</p></div>
      </div>
    </Section>
    <Section title="Sync Queue & Conflict-Resolution Manager" sub="Push is idempotent by client UUIDv7 — replays never duplicate server records">
      <button className="btn" disabled={!online || !queue.length} onClick={() => syncNow.mutate()}>⬆ Sync now ({queue.length} queued)</button>
      {queue.map((q: any) => <div key={q.client_uuid} className="text-xs py-1 border-b border-stone-100 font-mono">{q.client_uuid} · {q.entity_type} · {q.client_created_at}</div>)}
      <h4 className="font-semibold text-sm mt-3">Unresolved conflicts (from server)</h4>
      {(pull.data?.conflicts ?? []).length ? (pull.data.conflicts as any[]).map((c: any) => <div key={c.id} className="text-sm py-1 border-b border-stone-100">⚠ Field <b>{c.field_name}</b> — client: {JSON.stringify(c.client_value)} vs server: {JSON.stringify(c.server_value)} · {c.resolution}</div>) : <p className="text-sm text-stone-400">No unresolved conflicts.</p>}
    </Section></div>)
}

/* ---------------- 22. System Configuration ---------------- */
function SysConfig() {
  const stations = useList('/stations/'); const tanks = useList('/fermentation-tanks/'); const beds = useList('/drying-beds/'); const grades = useList('/grade-definitions/'); const units = useList('/measurement-units/'); const bench = useList('/yield-benchmarks/'); const thresholds = useList('/threshold-configs/')
  return (<div>
    <Section title="Washing Station, Drying Bed & Parameter Setup — Master Data & Site Topology">
      <T rows={stations.rows} cols={[['code', 'Code'], ['name', 'Station'], ['station_type', 'Type'], ['region', 'Region'], ['altitude_m', 'Altitude m'], ['is_active', 'Active']]} />
      <div className="grid md:grid-cols-2 gap-4"><div><h4 className="font-semibold text-sm">Fermentation tanks</h4><T rows={tanks.rows} cols={[['tank_no', 'Tank'], ['capacity_kg', 'Capacity kg'], ['is_active', 'Active']]} /></div>
        <div><h4 className="font-semibold text-sm">Drying beds</h4><T rows={beds.rows} cols={[['bed_no', 'Bed No.'], ['capacity_kg', 'Capacity kg'], ['is_active', 'Active']]} /></div>
        <div><h4 className="font-semibold text-sm">Grades</h4><T rows={grades.rows} cols={[['code', 'Grade'], ['name', 'Name'], ['min_cup_score', 'Min cup'], ['max_defects', 'Max defects']]} /></div>
        <div><h4 className="font-semibold text-sm">Measurement units</h4><T rows={units.rows} cols={[['code', 'Unit'], ['name', 'Name'], ['to_base_factor', 'To base']]} /></div></div>
    </Section>
    <Section title="Yield Benchmarks & Alert Thresholds — Conversion & Threshold Rules">
      <T rows={bench.rows} cols={[['conversion', 'Conversion'], ['expected_ratio', 'Expected'], ['min_ratio', 'Min'], ['max_ratio', 'Max']]} />
      <T rows={thresholds.rows} cols={[['moisture_min_pct', 'Moisture min %'], ['moisture_max_pct', 'Moisture max %'], ['max_fuel_ratio_l_per_kg', 'Max fuel L/kg'], ['max_water_ratio_l_per_kg', 'Max water L/kg'], ['max_transit_shrinkage_pct', 'Max shrinkage %']]} />
    </Section></div>)
}

/* ---------------- 23. Users, Roles, Signatures, Audit ---------------- */
const ROLE_MATRIX: [string, string][] = [
  ['Machine Operator', 'Fuel/water registers, moisture readings, attendance entry'],
  ['Station Supervisor', 'Farmers, collection, procurement, processing, warehouse, HR, resources'],
  ['Industry Professional', 'Processing, warehouse, dry mill, traceability, physical quality'],
  ['Q-Grader', 'Cupping scorecards, quality approvals / export release'],
  ['Dry Mill Manager', 'Dry mill work orders, grading, inventory'],
  ['Export Officer', 'Buyers, contracts, export, logistics, proceeds'],
  ['Finance Manager', 'Finance GL, payments, payroll, lot costing'],
  ['Admin', 'Everything + system configuration + user/role management'],
]
function Users() {
  const assignments = useList('/user-station-roles/'); const creds = useList('/signature-credentials/'); const signoffs = useList('/dual-signoffs/'); const audit = useList('/audit-logs/')
  return (<div>
    <Section title="User Directory & Role Permission Matrix — RBAC & Station Scoping" sub="Enforced server-side by the Phase 2 RolePermission + station-scoped querysets">
      <T rows={ROLE_MATRIX.map(([r, p], i) => ({ id: i, role: r, perms: p }))} cols={[['role', 'Role'], ['perms', 'Write access']]} />
      <h4 className="font-semibold text-sm mt-3">Station-scoped assignments</h4><T rows={assignments.rows} cols={[['user', 'User ID'], ['role', 'Role ID'], ['station', 'Station ID (blank = all)']]} />
    </Section>
    <Section title="Cryptographic Signature Setup & Immutable Activity Log">
      <T rows={creds.rows} cols={[['user', 'User'], ['is_active', 'PIN credential active'], ['signature_sha256', 'Signature SHA-256']]} />
      <T rows={signoffs.rows} cols={[['document_type', 'Document'], ['first_role_label', 'First'], ['second_role_label', 'Second'], ['status', 'Status']]} />
      <h4 className="font-semibold text-sm mt-3">Append-only audit trail (hash-chained)</h4>
      <T rows={audit.rows} cols={[['occurred_at', 'When'], ['action', 'Action'], ['model_label', 'Model'], ['object_id', 'Object'], ['entry_hash', 'Hash']]} />
    </Section></div>)
}

/* ---------------- shell ---------------- */
const MODULES: [string, string, React.ComponentType][] = [
  ['dashboard', '1 · Executive Dashboard', Dashboard], ['farmers', '2 · Farmer Management', Farmers],
  ['collection', '3 · Coffee Collection', Collection], ['procurement', '4 · Procurement', Procurement],
  ['processing', '5 · Processing (FSM)', Processing], ['drymill', '6 · Dry Mill', DryMill],
  ['traceability', '7 · Traceability', Traceability], ['lots', '8 · Lot & Batch Studio', LotStudio],
  ['quality', '9 · Quality', Quality], ['warehouse', '10 · Warehouse', Warehouse],
  ['resources', '11 · Fuel & Water', Resources], ['hr', '12 · HR & Attendance', HR],
  ['payroll', '13 · Payroll', Payroll], ['buyers', '14 · Buyers & Contracts', Buyers],
  ['export', '15 · Export', ExportPage], ['logistics', '16 · Logistics', Logistics],
  ['finance', '17 · Finance & Accounting', Finance], ['payments', '18 · Payments', Payments],
  ['inventory', '19 · Inventory', Inventory], ['bi', '20 · BI Reports', BI],
  ['mobile', '21 · Mobile Field App', MobileField], ['config', '22 · System Configuration', SysConfig],
  ['users', '23 · Users & Roles', Users],
]
export default function App() {
  const { user, ready, restore, logout } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [toastState, setToastState] = useState<{ msg: string; ok: boolean } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { restore() }, [])
  useEffect(() => { const fn = () => { /* background sync fired by SW */ }; navigator.serviceWorker?.addEventListener?.('message', fn as any); return () => {} }, [])
  const toast = (msg: string, ok = true) => { setToastState({ msg, ok }); setTimeout(() => setToastState(null), 6000) }
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-stone-500">Loading Murago ERP…</div>
  if (!user) return <ToastCtx.Provider value={toast}><Login />{toastEl(toastState)}</ToastCtx.Provider>
  const Active = MODULES.find(([id]) => id === page)?.[2] ?? Dashboard
  return (<ToastCtx.Provider value={toast}>
    <div className="min-h-screen flex">
      <aside className={`bg-stone-900 text-stone-200 w-64 shrink-0 p-3 fixed md:static inset-y-0 z-40 overflow-y-auto transition-transform ${menuOpen ? '' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center gap-2 px-2 py-3"><span className="text-2xl">☕</span><div><div className="font-bold text-white leading-tight">Murago Coffee ERP</div><div className="text-[11px] text-stone-400">Bean Power ERP · farm → export</div></div></div>
        <nav className="mt-2 space-y-0.5">{MODULES.map(([id, label]) => <button key={id} onClick={() => { setPage(id); setMenuOpen(false) }} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${page === id ? 'bg-amber-600 text-white font-semibold' : 'hover:bg-stone-800'}`}>{label}</button>)}</nav>
        <div className="mt-4 border-t border-stone-700 pt-3 px-2 text-xs text-stone-400">
          <div className="text-stone-200 font-semibold">{user.username}</div><div>{(user.role_codes ?? []).join(', ') || '—'}</div>
          <button className="btn-ghost mt-2 !border-stone-600 text-stone-200" onClick={() => logout()}>Sign out</button>
          <div className="mt-2">{navigator.onLine ? '🟢 Online' : '🔴 Offline'} · PWA installable</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-3 md:p-5">
        <div className="flex items-center gap-3 mb-4"><button className="btn-ghost md:hidden" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          <h2 className="text-lg md:text-xl font-bold text-stone-800">{MODULES.find(([id]) => id === page)?.[1]}</h2></div>
        <Active />
      </main>
    </div>
    {toastEl(toastState)}
  </ToastCtx.Provider>)
}
function toastEl(t: { msg: string; ok: boolean } | null) {
  return t ? <div className={`toast ${t.ok ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>{t.msg}</div> : null
}
