import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, queueOffline, queuedRecords, clearQueued, uuidv7 } from './api'
import { Badge, Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'

export function Traceability({ view = 'all' }: { view?: string } = {}) {
  const lots = useList('/lots/'); const checks = useList('/commingling-checks/')
  const [lotId, setLotId] = useState('')
  const q = useQuery({ queryKey: ['trace', lotId], queryFn: () => api(`/lots/${lotId}/traceability/`), enabled: !!lotId })
  const nodes = q.data?.nodes ?? []; const edges = q.data?.edges ?? []
  const byId = useMemo(() => Object.fromEntries(nodes.map((n: any) => [n.id, n])), [nodes])
  return (<div>
    {((view === 'all' || view === 'tree') && (<Section title="Interactive Farm-to-Export Traceability Tree" sub="Forward & backward DAG lineage: Farmer GPS origin → Collection → Processing → Drying Bed → Dry Mill → Warehouse → Export">
      <Field label="Lot"><select className="inp max-w-md" value={lotId} onChange={(e) => setLotId(e.target.value)}><option value="">Select a lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code} [{l.current_stage}]</option>)}</select></Field>
      {q.data && (<div className="mt-3">
        <div className="flex flex-wrap gap-2">{nodes.map((n: any) => <div key={n.id} className={`rounded-lg border px-3 py-2 text-sm ${n.id === lotId ? 'border-amber-500 bg-amber-50 font-bold' : 'border-stone-200 bg-white'}`}>{n.lot_code}<div className="text-xs text-stone-500">{n.current_stage} · {n.current_weight_kg} kg</div></div>)}</div>
        <h4 className="font-semibold text-sm mt-3">Lineage edges (parent → child)</h4>
        {edges.length ? edges.map((e: any) => <div key={e.id} className="text-sm py-1 border-b border-stone-100">{byId[e.parent_lot]?.lot_code ?? e.parent_lot} <span className="text-stone-400">—{e.edge_type} {e.weight_kg} kg (ratio {e.ratio})→</span> {byId[e.child_lot]?.lot_code ?? e.child_lot}</div>) : <p className="text-sm text-stone-400">No split/blend edges for this lot yet — use the Lot Studio.</p>}
      </div>)}
    </Section>))}
    {((view === 'all' || view === 'audit') && (<Section title="Mass-Balance Reconciliation (Phase 4)" sub="intake → cherry → parchment → green → bagged → exported; variances flagged ok / warning / critical, never silently allowed">
      <MassBalanceRunner />
    </Section>))}
    {((view === 'all' || view === 'audit') && (<Section title="Commingling Risk & Audit Monitor"><T state={checks} rows={checks.rows} cols={[['checked_at', 'Checked'], ['location_label', 'Location'], ['certified_separation_ok', 'Separation OK'], ['result', 'Result']]} /></Section>))}
  </div>)
}


function MassBalanceRunner() {
  const lots = useList('/lots/')
  const toast = useToast()
  const [lotId, setLotId] = useState(''); const [res, setRes] = useState<any>(null)
  const run = useMutation({ mutationFn: () => post(`/lots/${lotId}/mass-balance/`, {}), onSuccess: (d: any) => { setRes(d); toast(`Mass balance for ${d.lot}: worst = ${d.worst_status}`) }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div><div className="flex gap-2 items-end"><div className="w-72"><Field label="Lot"><select className="inp" value={lotId} onChange={(e) => setLotId(e.target.value)}><option value="">Select lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field></div>
    <button className="btn" onClick={() => run.mutate()}>Run mass-balance</button></div>
    {res && <div className="mt-2">{res.checks.map((ch: any) => <div key={ch.id} className="text-sm py-1 border-b border-stone-100"> <Badge value={ch.status} /> <b>{ch.segment}</b> — in {ch.input_kg} kg · out {ch.output_kg} kg · expected {ch.expected_output_kg} kg · variance {ch.variance_pct}%</div>)}</div>}
  </div>)
}


export function LotStudio({ view = 'all' }: { view?: string } = {}) {
  const lots = useList('/lots/'); const labels = useList('/lot-labels/')
  const toast = useToast(); const qc = useQueryClient()
  const [split, setSplit] = useState<any>({ parent: '', code: '', weight: '' })
  const [blend, setBlend] = useState<any>({ code: '', a: '', aw: '', b: '', bw: '' })
  const doSplit = useMutation({ mutationFn: () => post(`/lots/${split.parent}/split/`, { splits: [{ lot_code: split.code, weight_kg: split.weight }] }), onSuccess: (d: any) => { toast(`Split done: ${JSON.stringify(d.edges)}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const doBlend = useMutation({ mutationFn: () => post('/lots/blend/', { child: { lot_code: blend.code }, contributions: [{ lot_id: blend.a, weight_kg: blend.aw }, { lot_id: blend.b, weight_kg: blend.bw }] }), onSuccess: (d: any) => { toast(`Blend created: ${d.child} = ${d.weight_kg} kg`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const lotSelect = (v: string, set: (x: string) => void) => <select className="inp" value={v} onChange={(e) => set(e.target.value)}><option value="">Select lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code} ({l.current_weight_kg} kg)</option>)}</select>
  return (<div>
    {((view === 'all' || view === 'studio') && (<Section title="Lot Creation, Splitting & Blending Studio" sub="Parent-child weight ratios preserved by the DAG engine; over-draw is rejected">
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
    </Section>))}
    {((view === 'all' || view === 'labels') && (<Section title="Lot Barcode/QR Print Queue"><T state={labels} rows={labels.rows} cols={[['qr_payload', 'QR payload'], ['net_weight_kg', 'Net kg'], ['status', 'Status']]} /></Section>))}
  </div>)
}


const CUP_FIELDS = ['fragrance_aroma', 'flavour', 'aftertaste', 'acidity', 'body', 'balance', 'uniformity', 'clean_cup', 'sweetness', 'overall'] as const
export function Quality({ view = 'all' }: { view?: string } = {}) {
  const physical = useList('/physical-analyses/'); const cuppings = useList('/cupping-scores/'); const approvals = useList('/quality-approvals/')
  const lots = useList('/lots/')
  const toast = useToast(); const qc = useQueryClient()
  const [cup, setCup] = useState<any>({ lot: '', cupped_on: new Date().toISOString().slice(0, 10), fragrance_aroma: 8, flavour: 8, aftertaste: 8, acidity: 8, body: 8, balance: 8, uniformity: 10, clean_cup: 10, sweetness: 10, overall: 8 })
  const radarData = CUP_FIELDS.map((f) => ({ axis: f.replace(/_/g, ' '), score: Number(cup[f]) || 0 }))
  const saveCup = useMutation({ mutationFn: () => post('/cupping-scores/', cup), onSuccess: () => { toast('Cupping scorecard saved'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  const decide = useMutation({ mutationFn: ({ id, decision }: any) => post(`/cupping-scores/${id}/decide/`, { decision, grade: '1', remarks: decision === 'approved' ? 'Released for export' : 'Rejected at cupping' }), onSuccess: () => { toast('Quality decision recorded'); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'physical') && (<Section title="Lab Physical Inspection Worksheet"><T state={physical} rows={physical.rows} cols={[['analysed_on', 'Date'], ['moisture_pct', 'Moisture %'], ['moisture_warning', 'Outside 10.5–11.5'], ['water_activity', 'a_w'], ['bean_density', 'Density'], ['colour', 'Colour'], ['primary_defects', 'Primary defects'], ['secondary_defects', 'Secondary defects']]} /></Section>))}
    {((view === 'all' || view === 'cupping') && (<Section title="Q-Grader Cupping Scorecard & Lot Approval" sub="Spider chart preview updates as you score (0–10 per attribute)">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Field label="Lot"><select className="inp" value={cup.lot} onChange={(e) => setCup({ ...cup, lot: e.target.value })}><option value="">Select…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-2 mt-2">{CUP_FIELDS.map((f) => <Field key={f} label={f.replace(/_/g, ' ')}><input className="inp" type="number" step="0.25" min="0" max="10" value={cup[f]} onChange={(e) => setCup({ ...cup, [f]: e.target.value })} /></Field>)}</div>
          <button className="btn mt-3" onClick={() => saveCup.mutate()}>Save scorecard</button></div>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData}><PolarGrid stroke="var(--chart-grid)" /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "var(--muted)" }} /><Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.45} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} /></RadarChart></ResponsiveContainer></div>
      </div>
      <div className="mt-3">{cuppings.rows.map((c: any) => <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-stone-100 text-sm"><span className="font-medium">{c.cupped_on}</span><span>Total: <b>{c.total_score}</b></span>
        <button className="btn !py-1 text-xs" onClick={() => decide.mutate({ id: c.id, decision: 'approved' })}>Approve for export (Grade 1)</button>
        <button className="btn-ghost !py-1 text-xs" onClick={() => decide.mutate({ id: c.id, decision: 'rejected' })}>Reject</button></div>)}</div>
      <h4 className="font-semibold text-sm mt-3">Quality approvals</h4><T state={approvals} rows={approvals.rows} cols={[['grade', 'Grade'], ['decision', 'Decision'], ['decided_at', 'Decided'], ['remarks', 'Remarks']]} />
    </Section>))}</div>)
}


export function Warehouse({ view = 'all' }: { view?: string } = {}) {
  const stores = useList('/stores/'); const bins = useList('/bins/'); const transfers = useList('/stock-transfers/'); const passes = useList('/gate-passes/'); const receipts = useList('/stock-receipts/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ issued_by: '', received_by: '', received_kg: '' })
  const [tid, setTid] = useState('')
  const sign = useMutation({ mutationFn: () => post(`/stock-transfers/${tid}/dual-sign/`, { issued_by: f.issued_by, received_by: f.received_by, received_kg: f.received_kg || null }), onSuccess: (d: any) => { toast(`Transfer dual-signed · status ${d.status} · shrinkage ${d.shrinkage_kg ?? '—'} kg`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'bins') && (<Section title="Warehouse Bin Map & Anti-Commingling Grid" sub="Segregated stores: parchment / natural cherry / milled green">
      <div className="grid md:grid-cols-3 gap-3">{stores.rows.map((s: any) => (<div key={s.id} className="border border-stone-200 rounded-xl p-3"><div className="font-bold">{s.code} — {s.name}</div><div className="text-xs text-stone-500 mb-2">Form: {s.coffee_form}</div>
        <div className="grid grid-cols-3 gap-1">{bins.rows.filter((b: any) => b.store === s.id).map((b: any) => <div key={b.id} className={`rounded-lg text-center text-xs py-2 ${b.certified_only ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100'}`}>{b.bin_code}<div>{b.capacity_kg} kg{b.certified_only ? ' · certified only' : ''}</div></div>)}</div></div>))}
      </div>
      {bins.rows.length > 0 && !stores.rows.length && <T state={bins} rows={bins.rows} cols={[['bin_code', 'Bin'], ['capacity_kg', 'Capacity kg'], ['certified_only', 'Certified only']]} />}
    </Section>))}
    {((view === 'all' || view === 'transfers') && (<Section title="Inter-Store Transfer & Gate Pass Manager" sub="Dual-signed receipts · dispatch vs received out-turn shrinkage">
      <T state={receipts} rows={receipts.rows} cols={[['receipt_number', 'Receipt'], ['received_date', 'Date'], ['weight_kg', 'Weight kg'], ['bags', 'Bags']]} />
      <T state={transfers} rows={transfers.rows} cols={[['transfer_number', 'Transfer'], ['dispatched_kg', 'Dispatched kg'], ['received_kg', 'Received kg'], ['status', 'Status']]} />
      <div className="grid md:grid-cols-4 gap-2 mt-3">
        <Field label="Transfer"><select className="inp" value={tid} onChange={(e) => setTid(e.target.value)}><option value="">Select…</option>{transfers.rows.map((t: any) => <option key={t.id} value={t.id}>{t.transfer_number}</option>)}</select></Field>
        <Field label="Issued By"><UserSelect value={f.issued_by} onChange={(v: string) => setF({ ...f, issued_by: v })} /></Field>
        <Field label="Received By"><UserSelect value={f.received_by} onChange={(v: string) => setF({ ...f, received_by: v })} /></Field>
        <Field label="Received kg (out-turn)"><input className="inp" type="number" value={f.received_kg} onChange={(e) => setF({ ...f, received_kg: e.target.value })} /></Field>
      </div><button className="btn mt-2" onClick={() => sign.mutate()}>Dual-sign transfer</button>
      <h4 className="font-semibold text-sm mt-3">Gate passes</h4><T state={passes} rows={passes.rows} cols={[['pass_number', 'Pass'], ['vehicle_plate', 'Plate'], ['weight_kg', 'Weight kg'], ['issued_at', 'Issued']]} />
    </Section>))}</div>)
}


export function Logistics({ view = 'all' }: { view?: string } = {}) {
  const transporters = useList('/transporters/'); const vehicles = useList('/vehicles/'); const waybills = useList('/waybills/'); const checkpoints = useList('/transit-checkpoints/')
  return (<div>
    {((view === 'all' || view === 'fleet' || view === 'waybills') && (<Section title="Vehicle Assignment & Waybill Generator">{view !== 'waybills' && (<T state={transporters} rows={transporters.rows} cols={[['code', 'Code'], ['company_name', 'Transporter'], ['phone', 'Phone']]} />)}
      {view !== 'waybills' && (<T state={vehicles} rows={vehicles.rows} cols={[['plate_number', 'Plate'], ['vehicle_type', 'Type'], ['capacity_kg', 'Capacity kg'], ['driver_name', 'Driver']]} />)}
      {view !== 'fleet' && (<T state={waybills} rows={waybills.rows} cols={[['waybill_number', 'Waybill'], ['dispatched_kg', 'Dispatched kg'], ['delivered_kg', 'Delivered kg'], ['status', 'Status']]} />)}</Section>))}
    {((view === 'all' || view === 'transit') && (<Section title="Station-to-Addis & Djibouti Port Transit Monitor" sub="Checkpoint arrivals · receiving vs dispatch weight shrinkage">
      <T state={checkpoints} rows={checkpoints.rows} cols={[['kind', 'Checkpoint'], ['location_label', 'Location'], ['arrived_at', 'Arrived'], ['verified_weight_kg', 'Verified kg']]} />
      {waybills.rows.map((w: any) => w.delivered_kg ? <p key={w.id} className="text-sm py-1">{w.waybill_number}: shrinkage <b>{(Number(w.dispatched_kg) - Number(w.delivered_kg)).toFixed(2)} kg</b></p> : null)}
    </Section>))}</div>)
}

