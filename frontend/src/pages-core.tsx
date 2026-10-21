import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, queueOffline, queuedRecords, clearQueued, uuidv7 } from './api'
import { Badge, Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'
import L from 'leaflet'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const STAGES = ['harvesting_sorting', 'receiving', 'pulping', 'fermenting', 'washing', 'drying', 'conditioning', 'dry_milling', 'bag_marking', 'packing', 'storing', 'exporting']
export function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard/') })
  const d = q.data
  const snapshotsQ = useList('/dashboard-snapshots/'); const snapshots = snapshotsQ.rows
  if (!d) return q.isError ? <div className="card text-sm" style={{color:'var(--danger)'}}>Dashboard unavailable: {errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>Retry</button></div> : <div className="space-y-2">{[0,1,2].map(i=><div key={i} className="skeleton h-20 w-full" />)}</div>
  const stageData = STAGES.map((s) => ({ stage: s.replace(/_/g, ' '), lots: d.lots_by_stage?.[s] ?? 0 }))
  const kpis: [string, any][] = [['Lots in pipeline', d.lots_total], ['Cherry procured (kg)', d.cherry_procured_kg], ['Warehouse stock (kg)', d.warehouse_stock_kg], ['Open export contracts', d.open_contracts], ['Committed stock (kg)', d.committed_kg], ['Farmers registered', d.farmers], ['Containers open', d.containers_open], ['Avg fuel ratio (L/kg)', String(d.avg_fuel_ratio).slice(0, 7)], ['Avg water ratio (L/kg)', String(d.avg_water_ratio).slice(0, 7)], ['Fuel anomalies', d.fuel_anomalies], ['Water anomalies', d.water_anomalies]]
    return (<div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">{kpis.map(([l, v]) => <div key={l} className="card"><div className="lbl">{l}</div><div className="kpi">{String(v)}</div></div>)}</div>
    <Section title="Station & Pipeline Telemetry — lots by FSM stage" sub="Live Operations Command Center · contract position: committed vs warehouse stock shown above">
      <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stageData}><CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" /><XAxis dataKey="stage" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={0} angle={-30} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted)" }} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} /><Bar dataKey="lots" fill="var(--accent)" /></BarChart></ResponsiveContainer></div>
    </Section>
    <Section title="Executive Financial & Contract Summary (snapshots)"><T state={snapshotsQ} rows={snapshots} cols={[['snapshot_date', 'Date'], ['cherry_procured_kg', 'Cherry kg'], ['warehouse_stock_kg', 'Stock kg'], ['cash_float_balance', 'Cash float'], ['landed_cost_per_kg', 'Landed cost/kg'], ['export_containers_open', 'Containers']]} /></Section>
  </div>)
}


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
export function Farmers({ view = 'all' }: { view?: string } = {}) {
  const _q = useList('/farmers/'); const rows = _q.rows
  const plots = useList('/farm-plots/')
  const certs = useList('/certifications/')
  const dds = useList('/eudr-statements/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ farmer_code: '', full_name: '', phone: '', kebele: '', coffee_tree_count: 0, annual_cherry_cap_kg: 0, station: '' })
  const create = useMutation({ mutationFn: () => post('/farmers/', f), onSuccess: () => { toast('Farmer registered'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'directory') && (<Section title="Farmer Directory & Profile View — Outgrower Registry & KYC" sub="Annual cherry cap (anti-illicit-blending) enforced from registered plot size">
      <T state={_q} rows={rows} cols={[['farmer_code', 'Farmer ID'], ['full_name', 'Name'], ['phone', 'Phone'], ['kebele', 'Kebele'], ['coffee_tree_count', 'Trees'], ['annual_cherry_cap_kg', 'Cap kg/yr'], ['delivered_this_season_kg', 'Delivered kg'], ['kyc_status', 'KYC']]} />
      <div className="grid md:grid-cols-4 gap-2 mt-3">
        <Field label="Farmer ID"><input className="inp" value={f.farmer_code} onChange={(e) => setF({ ...f, farmer_code: e.target.value })} placeholder="FRM-2026-0100" /></Field>
        <Field label="Full name"><input className="inp" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Station"><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
        <Field label="Annual cap (kg)"><input className="inp" type="number" value={f.annual_cherry_cap_kg} onChange={(e) => setF({ ...f, annual_cherry_cap_kg: e.target.value })} /></Field>
      </div><button className="btn mt-2" onClick={() => create.mutate()}>Register farmer</button>
    </Section>))}
    {((view === 'all' || view === 'gis') && (<Section title="Interactive Polygon Map & Document Vault — Farm GIS & EUDR" sub="PostGIS GeoJSON polygons · certifications · Due Diligence Statements">
      <FarmerMap plots={plots.rows} />
      <div className="grid md:grid-cols-2 gap-4 mt-3"><div><h4 className="font-semibold text-sm mb-1">Farm plots</h4><T state={plots} rows={plots.rows} cols={[['plot_name', 'Plot'], ['area_ha', 'ha'], ['elevation_m', 'Elev. m'], ['coffee_variety', 'Variety'], ['deforestation_free', 'Deforestation-free']]} /></div>
        <div><h4 className="font-semibold text-sm mb-1">Certifications & EUDR DDS</h4><T state={certs} rows={certs.rows} cols={[['cert_type', 'Type'], ['certificate_number', 'Cert #'], ['expires_on', 'Expires']]} /><T state={dds} rows={dds.rows} cols={[['reference_number', 'DDS ref'], ['status', 'Status']]} /></div></div>
    </Section>))}</div>)
}


export function Collection({ view = 'all' }: { view?: string } = {}) {
  const centers = useList('/collection-centers/'); const agents = useList('/agent-assignments/')
  const intakes = useList('/cherry-intakes/'); const farmers = useList('/farmers/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ intake_number: '', farmer: '', center: '', station: '', intake_date: new Date().toISOString().slice(0, 10), coffee_variety: 'Heirloom', gross_kg: 0, tare_kg: 0, floater_deduction_pct: 0, unit_price: 85, qr_receipt_code: '' })
  const net = Math.max(0, (Number(f.gross_kg) || 0) - (Number(f.tare_kg) || 0))
  const payable = net * (1 - (Number(f.floater_deduction_pct) || 0) / 100)
  const create = useMutation({ mutationFn: () => post('/cherry-intakes/', { ...f, qr_receipt_code: f.qr_receipt_code || `QR-${f.intake_number}` }), onSuccess: (d: any) => { toast(`Intake saved — net ${d.net_kg} kg, payable ${d.payable_kg} kg, total ${d.total_amount} ETB · QR receipt: ${d.qr_receipt_code}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'centers') && (<Section title="Collection Center & Agent Assignment"><T state={centers} rows={centers.rows} cols={[['code', 'Code'], ['name', 'Center'], ['altitude_m', 'Altitude m'], ['is_active', 'Active']]} /><h4 className="font-semibold text-sm mt-3">Field purchasing agent assignments</h4><T state={agents} rows={agents.rows} cols={[['valid_from','Valid from'],['valid_to','Valid to']]} /></Section>))}
    {((view === 'all' || view === 'intake') && (<Section title="Daily Cherry Intake & Scale Terminal — Weighbridge" sub="net = gross − tare · payable = net − floatation deduction · QR intake receipt issued on save">
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
      <div className="mt-3"><T state={intakes} rows={intakes.rows} cols={[['intake_number', 'Intake #'], ['intake_date', 'Date'], ['gross_kg', 'Gross'], ['tare_kg', 'Tare'], ['net_kg', 'Net'], ['payable_kg', 'Payable'], ['total_amount', 'Total ETB'], ['qr_receipt_code', 'QR receipt']]} /></div>
    </Section>))}</div>)
}


export function Procurement({ view = 'all' }: { view?: string } = {}) {
  const prices = useList('/daily-prices/'); const vouchers = useList('/purchase-vouchers/'); const grns = useList('/grns/'); const suppliers = useList('/suppliers/')
  const toast = useToast(); const qc = useQueryClient()
  const [p, setP] = useState<any>({ station: '', price_date: new Date().toISOString().slice(0, 10), product: 'cherry', grade: '1', price_per_kg: 85 })
  const create = useMutation({ mutationFn: () => post('/daily-prices/', p), onSuccess: () => { toast('Daily price set'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'prices') && (<Section title="Daily Buying Price & Supplier Configuration">
      <div className="grid md:grid-cols-5 gap-2"><Field label="Station"><StationSelect value={p.station} onChange={(v: string) => setP({ ...p, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={p.price_date} onChange={(e) => setP({ ...p, price_date: e.target.value })} /></Field>
        <Field label="Product"><select className="inp" value={p.product} onChange={(e) => setP({ ...p, product: e.target.value })}><option value="cherry">Red cherry</option><option value="parchment">Parchment</option></select></Field>
        <Field label="Grade"><input className="inp" value={p.grade} onChange={(e) => setP({ ...p, grade: e.target.value })} /></Field>
        <Field label="Price / kg"><input className="inp" type="number" value={p.price_per_kg} onChange={(e) => setP({ ...p, price_per_kg: e.target.value })} /></Field></div>
      <button className="btn mt-2" onClick={() => create.mutate()}>Set daily price</button>
      <T state={prices} rows={prices.rows} cols={[['price_date', 'Date'], ['product', 'Product'], ['grade', 'Grade'], ['price_per_kg', 'ETB/kg']]} />
      <h4 className="font-semibold text-sm mt-3">Suppliers (ACRs / cooperatives)</h4><T state={suppliers} rows={suppliers.rows} cols={[['code', 'Code'], ['name', 'Supplier'], ['supplier_type', 'Type'], ['phone', 'Phone']]} />
    </Section>))}
    {((view === 'all' || view === 'vouchers') && (<Section title="Purchase Ledger & Voucher Approval — Vouchers & GRNs"><T state={vouchers} rows={vouchers.rows} cols={[['voucher_number', 'Voucher'], ['voucher_date', 'Date'], ['quantity_kg', 'Qty kg'], ['total_amount', 'Total'], ['status', 'Status']]} /><T state={grns} rows={grns.rows} cols={[['grn_number', 'GRN'], ['received_date', 'Received'], ['received_kg', 'Received kg'], ['variance_kg', 'Variance']]} /></Section>))}
  </div>)
}


export function Processing({ view = 'all' }: { view?: string } = {}) {
  const _q = useList('/lots/'); const lots = _q.rows
  const toast = useToast(); const qc = useQueryClient()
  const advance = useMutation({ mutationFn: (lot: any) => post(`/lots/${lot.id}/advance/`, {}), onSuccess: (d: any) => { toast(`Lot advanced → ${d.to_stage}`); qc.invalidateQueries() }, onError: (e: any) => toast(`Illegal move blocked: ${errMsg(e)}`, false) })
  const moveTo = useMutation({ mutationFn: ({ lot, stage }: any) => post(`/lots/${lot.id}/transition/`, { to_stage: stage }), onSuccess: () => { toast('Transition recorded'); qc.invalidateQueries() }, onError: (e: any) => toast(`Illegal move blocked: ${errMsg(e)}`, false) })
  return (<div>
    {((view === 'all' || view === 'kanban') && (<Section title="Station Processing Kanban & Stage Tracker — FSM" sub="Stages advance strictly one step (FSM). Illegal skips are rejected by the API with an error toast.">
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
    </Section>))}
    {(view === 'all' || view === 'handover') && <HandoverForm lots={lots} />}
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
    {warn && <p className="text-amber-700 text-xs mt-1">Moisture {f.final_moisture_pct}% is outside the 10.5%–11.5% target band.</p>}
    <button className="btn mt-2" onClick={() => submit.mutate()}>Record handover + dual sign</button>
    <div className="grid md:grid-cols-2 gap-4 mt-3"><div><h4 className="font-semibold text-sm">Moisture readings</h4><T state={readings} rows={readings.rows} cols={[['reading_date', 'Date'], ['moisture_pct', 'Moisture %'], ['moisture_warning', 'Outside 10.5–11.5']]} /></div>
      <div><h4 className="font-semibold text-sm">Handovers</h4><T state={handovers} rows={handovers.rows} cols={[['storage_date', 'Storage date'], ['final_moisture_pct', 'Moisture %'], ['dried_coffee_kg', 'Dried kg']]} /></div></div>
  </Section>)
}


export function DryMill({ view = 'all' }: { view?: string } = {}) {
  const wos = useList('/milling-work-orders/'); const outs = useList('/milling-outputs/'); const grading = useList('/grading-records/'); const screens = useList('/screen-distributions/')
  const lots = useList('/lots/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ order_number: '', mill_station: '', input_lot: '', scheduled_date: new Date().toISOString().slice(0, 10) })
  const create = useMutation({ mutationFn: () => post('/milling-work-orders/', f), onSuccess: () => { toast('Milling work order created'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'orders') && (<Section title="Dry Mill Batch Processing Terminal — work orders & hulling mass-balance">
      <div className="grid md:grid-cols-4 gap-2"><Field label="Order #"><input className="inp" value={f.order_number} onChange={(e) => setF({ ...f, order_number: e.target.value })} placeholder="MWO-2026-001" /></Field>
        <Field label="Mill station"><StationSelect value={f.mill_station} onChange={(v: string) => setF({ ...f, mill_station: v })} /></Field>
        <Field label="Input lot"><select className="inp" value={f.input_lot} onChange={(e) => setF({ ...f, input_lot: e.target.value })}><option value="">Select…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
        <Field label="Scheduled"><input className="inp" type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></Field></div>
      <button className="btn mt-2" onClick={() => create.mutate()}>Create work order</button>
      <T state={wos} rows={wos.rows} cols={[['order_number', 'Order'], ['status', 'Status'], ['scheduled_date', 'Scheduled']]} />
      <T state={outs} rows={outs.rows} cols={[['input_kg', 'Input kg'], ['green_out_kg', 'Green out kg'], ['husk_kg', 'Husk kg'], ['loss_kg', 'Loss kg']]} />
    </Section>))}
    {((view === 'all' || view === 'grading') && (<Section title="Screen Sizing, Gravity & Color Sorting Log"><T state={grading} rows={grading.rows} cols={[['graded_on', 'Date'], ['gravity_table_kg', 'Gravity kg'], ['color_sorted_kg', 'Color kg'], ['hand_picked_kg', 'Hand-picked kg'], ['rejects_kg', 'Rejects kg']]} />
      <T state={screens} rows={screens.rows} cols={[['screen_size', 'Screen'], ['weight_kg', 'Weight kg']]} /></Section>))}
  </div>)
}


/* ---- Command > Financial Position (Sub-Module 1.2) ---- */
export function FinancialPosition() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard/') })
  const snapshotsQ = useList('/dashboard-snapshots/'); const snapshots = snapshotsQ.rows
  const contracts = useList('/sales-contracts/')
  const d = q.data
  if (!d) return q.isError
    ? <div className="card text-sm" style={{ color: 'var(--danger)' }}>Financial position unavailable: {errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>Retry</button></div>
    : <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
  const kpis: [string, any][] = [['Open export contracts', d.open_contracts], ['Committed stock (kg)', d.committed_kg], ['Warehouse stock (kg)', d.warehouse_stock_kg], ['Unallocated stock (kg)', (Number(d.warehouse_stock_kg) - Number(d.committed_kg)).toFixed(2)], ['Cherry procured (kg)', d.cherry_procured_kg], ['Containers open', d.containers_open]]
  return (<div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">{kpis.map(([l, v]) => <div key={l} className="card"><div className="lbl">{l}</div><div className="kpi">{String(v)}</div></div>)}</div>
    <Section title="Open export contract positions — committed vs unallocated stock">
      <T state={contracts} rows={contracts.rows} cols={[['contract_number', 'Contract'], ['grade', 'Grade'], ['quantity_mt', 'MT'], ['quantity_bags', 'Bags'], ['incoterm', 'Incoterm'], ['currency', 'Ccy'], ['status', 'Status']]} />
    </Section>
    <Section title="Position snapshots — cash float & landed cost history">
      <T state={snapshotsQ} rows={snapshots} cols={[['snapshot_date', 'Date'], ['cash_float_balance', 'Cash float'], ['landed_cost_per_kg', 'Landed cost/kg'], ['warehouse_stock_kg', 'Stock kg'], ['export_containers_open', 'Containers']]} />
    </Section>
  </div>)
}

/* ---- Supply Base > Farmers > KYC & Documents (Sub-Module 2.1) ---- */
export function FarmerKyc() {
  const farmers = useList('/farmers/')
  const docs = useList('/farmer-documents/')
  return (<div>
    <Section title="Farmer KYC status" sub="National ID verification state per registered outgrower">
      <T state={farmers} rows={farmers.rows} cols={[['farmer_code', 'Farmer ID'], ['full_name', 'Name'], ['phone', 'Phone'], ['national_id_number', 'National ID'], ['kyc_status', 'KYC']]} />
    </Section>
    <Section title="Document vault — national ID, land certificates, photos" sub="Files live in object storage; the ERP stores the path reference + SHA-256 fingerprint">
      <T state={docs} rows={docs.rows} cols={[['doc_type', 'Document type'], ['file_path', 'Storage path'], ['sha256', 'SHA-256'], ['verified_at', 'Verified at']]} />
    </Section>
  </div>)
}

/* ---- Supply Base > Collection > Cash Floats (Sub-Module 3.1) ---- */
export function CashFloats() {
  const floats = useList('/cash-floats/')
  return (<Section title="Daily cash floats — allocation, spend & return per collection center">
    <T state={floats} rows={floats.rows} cols={[['float_date', 'Date'], ['amount_allocated', 'Allocated'], ['amount_spent', 'Spent'], ['amount_returned', 'Returned'], ['status', 'Status']]} />
  </Section>)
}
