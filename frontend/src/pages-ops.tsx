import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, queueOffline, queuedRecords, clearQueued, uuidv7 } from './api'
import { Badge, Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import { useTheme } from './theme'

export function Resources({ view = 'all' }: { view?: string } = {}) {
  const fuel = useList('/fuel-entries/'); const water = useList('/water-entries/')
  const toast = useToast(); const qc = useQueryClient()
  const [ff, setFf] = useState<any>({ station: '', entry_date: new Date().toISOString().slice(0, 10), machine_label: 'Generator 1', fuel_purchased_litres: 0, fuel_added_litres: 0, cherry_pulped_kg: 0 })
  const [wf, setWf] = useState<any>({ station: '', entry_date: new Date().toISOString().slice(0, 10), meter_reading_litres: 0, previous_reading_litres: 0, previous_day_pulped_kg: 0, recycled_litres: 0 })
  const fuelLocal = (Number(ff.cherry_pulped_kg) > 0) ? (Number(ff.fuel_added_litres) / Number(ff.cherry_pulped_kg)).toFixed(5) : '—'
  const waterLocal = (Number(wf.previous_day_pulped_kg) > 0) ? ((Number(wf.meter_reading_litres) - Number(wf.previous_reading_litres)) / Number(wf.previous_day_pulped_kg)).toFixed(5) : '—'
  const saveFuel = useMutation({ mutationFn: () => post('/fuel-entries/', ff), onSuccess: (d: any) => { toast(`Fuel saved · ratio ${d.fuel_ratio} L/kg ${d.is_anomaly ? '— ANOMALY flagged' : ''}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const saveWater = useMutation({ mutationFn: () => post('/water-entries/', wf), onSuccess: (d: any) => { toast(`Water saved · consumption ${d.consumption_litres} L · ratio ${d.water_ratio} L/prev-day-kg ${d.is_anomaly ? '— ANOMALY flagged' : ''}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'fuel') && (<Section title="Daily Fuel Consumption Register — የነዳጅ ፍጆታ መከታተያ ቅጽ" sub="Ratio auto-calculated by the API: litres ÷ kg pulped cherry that day">
      <div className="grid md:grid-cols-6 gap-2"><Field label="Station"><StationSelect value={ff.station} onChange={(v: string) => setFf({ ...ff, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={ff.entry_date} onChange={(e) => setFf({ ...ff, entry_date: e.target.value })} /></Field>
        <Field label="Machine"><input className="inp" value={ff.machine_label} onChange={(e) => setFf({ ...ff, machine_label: e.target.value })} /></Field>
        <Field label="Fuel purchased (L)"><input className="inp" type="number" value={ff.fuel_purchased_litres} onChange={(e) => setFf({ ...ff, fuel_purchased_litres: e.target.value })} /></Field>
        <Field label="Fuel added (L)"><input className="inp" type="number" value={ff.fuel_added_litres} onChange={(e) => setFf({ ...ff, fuel_added_litres: e.target.value })} /></Field>
        <Field label="Cherry pulped (kg)"><input className="inp" type="number" value={ff.cherry_pulped_kg} onChange={(e) => setFf({ ...ff, cherry_pulped_kg: e.target.value })} /></Field></div>
      <div className="flex gap-4 items-center mt-2 text-sm"><span>Live ratio: <b>{fuelLocal} L/kg</b></span><button className="btn" onClick={() => saveFuel.mutate()}>Save fuel entry</button></div>
      <T state={fuel} rows={fuel.rows} cols={[['entry_date', 'Date'], ['machine_label', 'Machine'], ['fuel_added_litres', 'Added L'], ['cherry_pulped_kg', 'Pulped kg'], ['fuel_ratio', 'Fuel ratio L/kg'], ['is_anomaly', 'Anomaly']]} />
    </Section>))}
    {((view === 'all' || view === 'water') && (<Section title="Daily Water Consumption Register — የውሃ ፍጆታ መከታተያ ቅጽ" sub="Midday (12:00 PM / 6:00 local) meter reading · ratio = consumption ÷ PREVIOUS day's pulped kg">
      <div className="grid md:grid-cols-6 gap-2"><Field label="Station"><StationSelect value={wf.station} onChange={(v: string) => setWf({ ...wf, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={wf.entry_date} onChange={(e) => setWf({ ...wf, entry_date: e.target.value })} /></Field>
        <Field label="Meter reading (L)"><input className="inp" type="number" value={wf.meter_reading_litres} onChange={(e) => setWf({ ...wf, meter_reading_litres: e.target.value })} /></Field>
        <Field label="Previous reading (L)"><input className="inp" type="number" value={wf.previous_reading_litres} onChange={(e) => setWf({ ...wf, previous_reading_litres: e.target.value })} /></Field>
        <Field label="Prev-day pulped (kg)"><input className="inp" type="number" value={wf.previous_day_pulped_kg} onChange={(e) => setWf({ ...wf, previous_day_pulped_kg: e.target.value })} /></Field>
        <Field label="Recycled (L)"><input className="inp" type="number" value={wf.recycled_litres} onChange={(e) => setWf({ ...wf, recycled_litres: e.target.value })} /></Field></div>
      <div className="flex gap-4 items-center mt-2 text-sm"><span>Live ratio: <b>{waterLocal} L/prev-kg</b></span><button className="btn" onClick={() => saveWater.mutate()}>Save water entry</button></div>
      <T state={water} rows={water.rows} cols={[['entry_date', 'Date'], ['consumption_litres', 'Consumption L'], ['previous_day_pulped_kg', 'Prev-day kg'], ['water_ratio', 'Water ratio'], ['is_anomaly', 'Anomaly'], ['lagoon_level_pct', 'Lagoon %']]} />
    </Section>))}</div>)
}


export function HR({ view = 'all' }: { view?: string } = {}) {
  const { theme } = useTheme()
  const workers = useList('/workers/'); const sheets = useList('/attendance-sheets/'); const entries = useList('/attendance-entries/')
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
    {((view === 'all' || view === 'workers') && (<Section title="Casual Labor & Operator Onboarding — Seasonal Worker Registry"><T state={workers} rows={workers.rows} cols={[['worker_code', 'Worker ID ተ.ቁ'], ['full_name', 'Name'], ['kind', 'Kind'], ['wage_type', 'Wage type'], ['wage_rate', 'Rate ETB'], ['is_active', 'Active']]} /></Section>))}
    {((view === 'all' || view === 'attendance') && (<Section title="30-Day Worker Attendance Grid — የቀን ሠራተኞች የሥራ ሰዓት መቆጣጠሪያ ቅጽ" sub="AG Grid Community · inline editing (✓ present, ½ half, ✗ absent, L leave) · ወር / ዓ.ም Ethiopian month/year · locked by dual signatures">
      <div className="grid md:grid-cols-5 gap-2 mb-3">
        <Field label="Sheet (ወር / ዓ.ም)"><select className="inp" value={sheetId} onChange={(e) => setSheetId(e.target.value)}><option value="">Select sheet…</option>{sheets.rows.map((s: any) => <option key={s.id} value={s.id}>{s.ethiopian_month} / {s.ethiopian_year} — {s.status}</option>)}</select></Field>
        <Field label="New sheet station"><StationSelect value={newSheet.station} onChange={(v: string) => setNewSheet({ ...newSheet, station: v })} /></Field>
        <Field label="ወር Month"><input className="inp" type="number" value={newSheet.ethiopian_month} onChange={(e) => setNewSheet({ ...newSheet, ethiopian_month: Number(e.target.value) })} /></Field>
        <Field label="ዓ.ም Year"><input className="inp" type="number" value={newSheet.ethiopian_year} onChange={(e) => setNewSheet({ ...newSheet, ethiopian_year: Number(e.target.value) })} /></Field>
        <div className="flex items-end"><button className="btn-ghost w-full justify-center" onClick={() => createSheet.mutate()}>+ New sheet</button></div>
      </div>
      <div className={theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} style={{ height: 340, width: '100%' }}>
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
    </Section>))}</div>)
}


export function Payroll() {
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
          <td className="td">{l.recipient_signed ? 'Signed' : <button className="btn-ghost !py-0.5 text-xs" onClick={() => signLine.mutate(l.id)}>Sign on tablet</button>}</td></tr>)}</tbody></table></div>
    </Section></div>)
}


export function Buyers({ view = 'all' }: { view?: string } = {}) {
  const buyers = useList('/buyers/'); const contracts = useList('/sales-contracts/'); const allocs = useList('/contract-allocations/'); const pss = useList('/sample-feedback/')
  return (<div>
    {((view === 'all' || view === 'buyers') && (<Section title="Buyer Directory & Sample Feedback Log — International Buyer CRM"><T state={buyers} rows={buyers.rows} cols={[['code', 'Code'], ['company_name', 'Buyer'], ['country', 'Country'], ['contact_name', 'Contact'], ['preferred_incoterm', 'Incoterm']]} />
      <T state={pss} rows={pss.rows} cols={[['sample_code', 'PSS sample'], ['sent_on', 'Sent'], ['status', 'PSS status'], ['feedback', 'Feedback']]} /></Section>))}
    {((view === 'all' || view === 'contracts') && (<Section title="Sales Contract & Price Fixation Ledger" sub="Outright price or ICE 'C' differential · lot allocation locks enforced by the API">
      <T state={contracts} rows={contracts.rows} cols={[['contract_number', 'Contract'], ['grade', 'Grade'], ['quantity_mt', 'MT'], ['quantity_bags', 'Bags'], ['pricing_basis', 'Pricing'], ['outright_price', 'Outright'], ['ice_differential', 'ICE diff'], ['incoterm', 'Incoterm'], ['currency', 'Ccy'], ['status', 'Status']]} />
      <h4 className="font-semibold text-sm mt-2">Lot allocations</h4><T state={allocs} rows={allocs.rows} cols={[['allocated_kg', 'Allocated kg'], ['allocated_bags', 'Bags'], ['is_locked', 'Locked']]} /></Section>))}
  </div>)
}


export function ExportPage({ view = 'all' }: { view?: string } = {}) {
  const markings = useList('/bag-markings/'); const packing = useList('/packing-records/'); const containers = useList('/containers/'); const docs = useList('/export-documents/')
  const sel = markings.rows[0]
  return (<div>
    {((view === 'all' || view === 'bagging') && (<Section title="Export Bagging & Stencil Generator (Steps 7 & 8)" sub="ICO markings + buyer stencils for 60 kg jute bags / GrainPro liners">
      <T state={markings} rows={markings.rows} cols={[['ico_mark', 'ICO mark'], ['buyer_stencil', 'Buyer stencil'], ['bag_type', 'Bag type'], ['crop_year', 'Crop']]} />
      {sel && <div className="mt-3 bg-stone-900 text-amber-400 rounded-xl p-5 font-mono text-center"><div className="text-2xl tracking-widest">{sel.ico_mark}</div><div className="text-lg mt-1">{sel.buyer_stencil}</div><div className="text-xs text-stone-400 mt-1">Stencil preview — {sel.bag_type} · crop {sel.crop_year}</div></div>}
      <T state={packing} rows={packing.rows} cols={[['packed_on', 'Packed'], ['bags_packed', 'Bags'], ['gross_kg', 'Gross kg'], ['net_kg', 'Net kg']]} />
    </Section>))}
    {((view === 'all' || view === 'containers') && (<Section title="Container Loading & Customs Documentation Suite (Step 10)">
      <T state={containers} rows={containers.rows} cols={[['container_number', 'Container'], ['seal_number', 'Seal'], ['total_bags', 'Bags'], ['total_net_kg', 'Net kg'], ['stuffed_on', 'Stuffed'], ['status', 'Status']]} />
      <T state={docs} rows={docs.rows} cols={[['doc_type', 'Document'], ['document_number', 'Doc #'], ['status', 'Status']]} />
      <ContainerReadiness />
      <p className="text-xs text-stone-500">Generated document types: Commercial Invoice · Packing List · ICO Certificate of Origin · ECTA clearance · Phytosanitary certificate · EUDR GeoJSON dossier (payloads stored on each ExportDocument).</p>
    </Section>))}</div>)
}


function ContainerReadiness() {
  const containers = useList('/containers/')
  const toast = useToast(); const qc = useQueryClient()
  const [chk, setChk] = useState<any>(null)
  const check = useMutation({ mutationFn: (id: string) => api(`/containers/${id}/checklist/`), onSuccess: (d: any) => setChk(d), onError: (e: any) => toast(errMsg(e), false) })
  const ready = useMutation({ mutationFn: (id: string) => post(`/containers/${id}/mark-ready/`, {}), onSuccess: () => { toast('Container sealed — document checklist complete'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div className="mt-3"><h4 className="font-semibold text-sm">Export document completeness checklist (Phase 4 gate)</h4>
    {containers.rows.map((ct: any) => <div key={ct.id} className="flex flex-wrap gap-2 items-center py-1.5 border-b border-stone-100 text-sm"><span className="font-medium">{ct.container_number}</span><span>{ct.status}</span>
      <button className="btn-ghost !py-1 text-xs" onClick={() => check.mutate(ct.id)}>Check documents</button>
      {ct.status === 'loading' && <button className="btn !py-1 text-xs" onClick={() => ready.mutate(ct.id)}>Mark ready (seal)</button>}</div>)}
    {chk && <div className="mt-2 text-sm bg-stone-50 rounded-lg p-3">{chk.items.map((i: any) => <div key={i.doc_type}>{i.present ? 'Present — ' : 'Missing — '}{i.label}</div>)}
      <div className="mt-1 font-semibold">{chk.complete ? 'Checklist COMPLETE — ready to seal' : `Missing: ${chk.missing.join(', ')}`}</div></div>}
  </div>)
}

