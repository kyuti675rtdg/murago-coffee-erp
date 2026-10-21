import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, queueOffline, queuedRecords, clearQueued, uuidv7 } from './api'
import { Badge, Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'

export function Finance({ view = 'all' }: { view?: string } = {}) {
  const accounts = useList('/accounts/'); const journals = useList('/journal-entries/'); const lines = useList('/journal-lines/'); const arap = useList('/receivables-payables/'); const allocs = useList('/lot-cost-allocations/')
  const lots = useList('/lots/'); const [lotId, setLotId] = useState('')
  const cost = useQuery({ queryKey: ['cost', lotId], queryFn: () => api(`/lot-costing/${lotId}/`), enabled: !!lotId })
  return (<div>
    {((view === 'all' || view === 'gl') && (<Section title="Chart of Accounts, Journals & AR/AP Ledger — multi-currency double-entry (ETB / USD / EUR)">
      <T state={accounts} rows={accounts.rows} cols={[['code', 'Code'], ['name', 'Account'], ['account_type', 'Type'], ['currency', 'Ccy']]} />
      <T state={journals} rows={journals.rows} cols={[['entry_number', 'Entry'], ['entry_date', 'Date'], ['description', 'Description'], ['status', 'Status']]} />
      <T state={lines} rows={lines.rows} cols={[['debit', 'Debit'], ['credit', 'Credit'], ['currency', 'Ccy'], ['exchange_rate', 'FX'], ['memo', 'Memo']]} />
      <JournalPostControls />
      <h4 className="font-semibold text-sm mt-2">AR / AP</h4><T state={arap} rows={arap.rows} cols={[['kind', 'Kind'], ['reference', 'Ref'], ['amount', 'Amount'], ['amount_settled', 'Settled'], ['currency', 'Ccy'], ['due_on', 'Due'], ['status', 'Status']]} />
    </Section>))}
    {((view === 'all' || view === 'costing') && (<Section title="Landed Cost & Lot Profitability Analyzer — activity-based lot costing">
      <Field label="Lot"><select className="inp max-w-md" value={lotId} onChange={(e) => setLotId(e.target.value)}><option value="">Select lot…</option>{lots.rows.map((l: any) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select></Field>
      {cost.data && <p className="text-sm mt-2">Landed cost for <b>{cost.data.lot}</b>: <b>{cost.data.landed_cost_per_kg ?? '—'} / kg</b> across {cost.data.allocations.length} allocations</p>}
      <T state={allocs} rows={allocs.rows} cols={[['component', 'Cost component'], ['amount', 'Amount'], ['currency', 'Ccy'], ['allocated_on', 'Date'], ['source_reference', 'Source ref']]} />
    </Section>))}</div>)
}


function JournalPostControls() {
  const journals = useList('/journal-entries/')
  const toast = useToast(); const qc = useQueryClient()
  const postJ = useMutation({ mutationFn: (id: string) => post(`/journal-entries/${id}/post-entry/`, {}), onSuccess: () => { toast('Journal posted (debits = credits verified)'); qc.invalidateQueries() }, onError: (e: any) => toast(`Posting blocked: ${errMsg(e)}`, false) })
  const drafts = journals.rows.filter((j: any) => j.status === 'draft')
  if (!drafts.length) return null
  return (<div className="mt-2">{drafts.map((j: any) => <div key={j.id} className="flex gap-2 items-center py-1 text-sm"><span>{j.entry_number} — {j.description}</span>
    <button className="btn !py-1 text-xs" onClick={() => postJ.mutate(j.id)}>Post journal (balance check)</button></div>)}</div>)
}


export function Payments() {
  const disb = useList('/disbursements/'); const proceeds = useList('/export-proceeds/'); const forex = useList('/forex-retentions/')
  return (<div>
    <Section title="Outgoing Payment Processing Center — field, supplier & worker disbursements"><T state={disb} rows={disb.rows} cols={[['reference', 'Ref'], ['payee_type', 'Payee'], ['amount', 'Amount'], ['currency', 'Ccy'], ['method', 'Method'], ['paid_on', 'Paid'], ['status', 'Status']]} /></Section>
    <Section title="Buyer Settlement & LC/CAD Reconciliation — SWIFT receipts & NBE forex retention">
      <T state={proceeds} rows={proceeds.rows} cols={[['settlement_type', 'Settlement'], ['swift_reference', 'SWIFT ref'], ['amount_usd', 'USD'], ['received_on', 'Received'], ['bank_name', 'Bank'], ['is_reconciled', 'Reconciled']]} />
      <T state={forex} rows={forex.rows} cols={[['retention_pct', 'Retention %'], ['retained_usd', 'Retained USD'], ['surrendered_usd', 'Surrendered USD'], ['etb_credited', 'ETB credited'], ['exchange_rate', 'FX rate']]} /></Section>
  </div>)
}


export function Inventory({ view = 'all' }: { view?: string } = {}) {
  const items = useList('/inventory-items/'); const moves = useList('/stock-movements/'); const audits = useList('/stock-audits/'); const adj = useList('/stock-adjustments/')
  return (<div>
    {((view === 'all' || view === 'items') && (<Section title="Packaging Material, Fuel Drum & Spare Parts Ledger" sub="Jute bags · GrainPro liners · drying bed mesh · twine · bulk diesel — reorder alerts at reorder level">
      <T state={items} rows={items.rows} cols={[['sku', 'SKU'], ['name', 'Item'], ['category', 'Category'], ['unit', 'Unit'], ['reorder_level', 'Reorder level']]} />
      <T state={moves} rows={moves.rows} cols={[['movement_date', 'Date'], ['movement_type', 'Type'], ['delta_qty', 'Delta'], ['reference', 'Ref']]} /></Section>))}
    {((view === 'all' || view === 'audits') && (<Section title="Stock Reconciliation & Adjustment Worksheet"><T state={audits} rows={audits.rows} cols={[['audit_number', 'Audit'], ['audit_date', 'Date'], ['status', 'Status']]} />
      <T state={adj} rows={adj.rows} cols={[['book_qty', 'Book qty'], ['counted_qty', 'Counted qty'], ['variance_reason', 'Variance reason']]} /></Section>))}
  </div>)
}


export function BI() {
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
      <T state={defs} rows={defs.rows} cols={[['code', 'Code'], ['name', 'Report'], ['kind', 'Kind'], ['is_active', 'Active']]} />
      <T state={generated} rows={generated.rows} cols={[['period_start', 'From'], ['period_end', 'To'], ['fmt', 'Format'], ['file_path', 'File']]} />
    </Section></div>)
}


export function MobileField() {
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
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{online ? 'Online' : 'Offline — capturing to local queue'} · Queued: {queue.length}</div>
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
      <button className="btn" disabled={!online || !queue.length} onClick={() => syncNow.mutate()}>Sync now ({queue.length} queued)</button>
      {queue.map((q: any) => <div key={q.client_uuid} className="text-xs py-1 border-b border-stone-100 font-mono">{q.client_uuid} · {q.entity_type} · {q.client_created_at}</div>)}
      <h4 className="font-semibold text-sm mt-3">Unresolved conflicts (from server)</h4>
      {(pull.data?.conflicts ?? []).length ? (pull.data.conflicts as any[]).map((c: any) => <div key={c.id} className="text-sm py-1 border-b border-stone-100">Field <b>{c.field_name}</b> — client: {JSON.stringify(c.client_value)} vs server: {JSON.stringify(c.server_value)} · {c.resolution}</div>) : <p className="text-sm text-stone-400">No unresolved conflicts.</p>}
    </Section></div>)
}


export function SysConfig() {
  const stations = useList('/stations/'); const tanks = useList('/fermentation-tanks/'); const beds = useList('/drying-beds/'); const grades = useList('/grade-definitions/'); const units = useList('/measurement-units/'); const bench = useList('/yield-benchmarks/'); const thresholds = useList('/threshold-configs/')
  return (<div>
    <Section title="Washing Station, Drying Bed & Parameter Setup — Master Data & Site Topology">
      <T state={stations} rows={stations.rows} cols={[['code', 'Code'], ['name', 'Station'], ['station_type', 'Type'], ['region', 'Region'], ['altitude_m', 'Altitude m'], ['is_active', 'Active']]} />
      <div className="grid md:grid-cols-2 gap-4"><div><h4 className="font-semibold text-sm">Fermentation tanks</h4><T state={tanks} rows={tanks.rows} cols={[['tank_no', 'Tank'], ['capacity_kg', 'Capacity kg'], ['is_active', 'Active']]} /></div>
        <div><h4 className="font-semibold text-sm">Drying beds</h4><T state={beds} rows={beds.rows} cols={[['bed_no', 'Bed No.'], ['capacity_kg', 'Capacity kg'], ['is_active', 'Active']]} /></div>
        <div><h4 className="font-semibold text-sm">Grades</h4><T state={grades} rows={grades.rows} cols={[['code', 'Grade'], ['name', 'Name'], ['min_cup_score', 'Min cup'], ['max_defects', 'Max defects']]} /></div>
        <div><h4 className="font-semibold text-sm">Measurement units</h4><T state={units} rows={units.rows} cols={[['code', 'Unit'], ['name', 'Name'], ['to_base_factor', 'To base']]} /></div></div>
    </Section>
    <Section title="Yield Benchmarks & Alert Thresholds — Conversion & Threshold Rules">
      <T state={bench} rows={bench.rows} cols={[['conversion', 'Conversion'], ['expected_ratio', 'Expected'], ['min_ratio', 'Min'], ['max_ratio', 'Max']]} />
      <T state={thresholds} rows={thresholds.rows} cols={[['moisture_min_pct', 'Moisture min %'], ['moisture_max_pct', 'Moisture max %'], ['max_fuel_ratio_l_per_kg', 'Max fuel L/kg'], ['max_water_ratio_l_per_kg', 'Max water L/kg'], ['max_transit_shrinkage_pct', 'Max shrinkage %']]} />
    </Section></div>)
}


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
export function Users({ view = 'all' }: { view?: string } = {}) {
  const assignments = useList('/user-station-roles/'); const creds = useList('/signature-credentials/'); const signoffs = useList('/dual-signoffs/'); const audit = useList('/audit-logs/')
  return (<div>
    {((view === 'all' || view === 'users') && (<Section title="User Directory & Role Permission Matrix — RBAC & Station Scoping" sub="Enforced server-side by the Phase 2 RolePermission + station-scoped querysets">
      <T rows={ROLE_MATRIX.map(([r, p], i) => ({ id: i, role: r, perms: p }))} cols={[['role', 'Role'], ['perms', 'Write access']]} />
      <h4 className="font-semibold text-sm mt-3">Station-scoped assignments</h4><T state={assignments} rows={assignments.rows} cols={[['user', 'User ID'], ['role', 'Role ID'], ['station', 'Station ID (blank = all)']]} />
    </Section>))}
    {((view === 'all' || view === 'users' || view === 'audit') && (<Section title="Cryptographic Signature Setup & Immutable Activity Log">
      {view !== 'audit' && (<T state={creds} rows={creds.rows} cols={[['user', 'User'], ['is_active', 'PIN credential active'], ['signature_sha256', 'Signature SHA-256']]} />)}
      {view !== 'audit' && (<T state={signoffs} rows={signoffs.rows} cols={[['document_type', 'Document'], ['first_role_label', 'First'], ['second_role_label', 'Second'], ['status', 'Status']]} />)}
      <h4 className="font-semibold text-sm mt-3">Append-only audit trail (hash-chained)</h4>
      <T state={audit} rows={audit.rows} cols={[['occurred_at', 'When'], ['action', 'Action'], ['model_label', 'Model'], ['object_id', 'Object'], ['entry_hash', 'Hash']]} />
    </Section>))}</div>)
}



/* ---- Finance & Insight > Finance > AR/AP (Sub-Module 17.1) ---- */
export function FinanceArap() {
  const arap = useList('/receivables-payables/')
  return (<Section title="Accounts Receivable / Payable ledger" sub="Buyer receivables and supplier/farmer payables with settlement tracking">
    <T state={arap} rows={arap.rows} cols={[['kind', 'Kind'], ['reference', 'Ref'], ['amount', 'Amount'], ['amount_settled', 'Settled'], ['currency', 'Ccy'], ['due_on', 'Due'], ['status', 'Status']]} />
  </Section>)
}

/* ---- Command > Notifications (Module 24) ---- */
export function NotificationsPage() {
  const items = useList('/notifications/')
  const toast = useToast(); const qc = useQueryClient()
  const mark = useMutation({ mutationFn: (id: string) => post(`/notifications/${id}/mark-read/`, {}), onSuccess: () => qc.invalidateQueries() })
  const markAll = useMutation({ mutationFn: () => post('/notifications/mark-all-read/', {}), onSuccess: () => { toast('All notifications marked read'); qc.invalidateQueries() } })
  return (<Section title="Notifications & Alerts Centre" sub="Anomalies (fuel/water/mass-balance), payroll and voucher-approval events" action={<button className="btn-ghost !py-1 text-xs" onClick={() => markAll.mutate()}>Mark all read</button>}>
    {items.isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
      : items.isError ? <p className="text-sm" style={{ color: 'var(--danger)' }}>Could not load notifications: {errMsg(items.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => items.refetch()}>Retry</button></p>
      : !items.rows.length ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No notifications.</p>
      : items.rows.map((n: any) => (
        <div key={n.id} className="flex flex-wrap items-center gap-3 py-2 text-sm" style={{ borderBottom: '1px solid var(--border)', opacity: n.is_read ? 0.6 : 1 }}>
          <Badge value={n.severity} />
          <div className="flex-1 min-w-[220px]"><div className="font-medium" style={{ color: 'var(--text)' }}>{n.title}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>{n.body}</div>
            <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{n.category} · {String(n.created_at).slice(0, 16).replace('T', ' ')}</div></div>
          {!n.is_read && <button className="btn-ghost !py-1 text-xs" onClick={() => mark.mutate(n.id)}>Mark read</button>}
        </div>))}
  </Section>)
}

/* ---- System > Backups (Module 25) ---- */
export function BackupsPage() {
  const q = useQuery({ queryKey: ['backups'], queryFn: () => api('/api/backups/') })
  const files = (q.data?.files ?? []) as any[]
  return (<Section title="Backup & Data Management" sub="Server-side backups produced by `python manage.py backup_db` (pg_dump SQL.gz or validated dumpdata JSON.gz). Restore: gunzip, then psql (SQL) or manage.py loaddata (JSON).">
    {q.isLoading ? <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
      : q.isError ? <p className="text-sm" style={{ color: 'var(--danger)' }}>Backup list unavailable: {errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>Retry</button></p>
      : (<T rows={files} cols={[['name', 'Backup file'], ['size_bytes', 'Bytes'], ['modified_at', 'Created']]} />)}
    <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Backups run on the server (Render shell / cron), never from the browser — this page is a read-only inventory of the backups directory.</p>
  </Section>)
}


export function RolesPermissions() {
  const toast = useToast(); const qc = useQueryClient()
  const matrix = useQuery({ queryKey: ['permission-matrix'], queryFn: () => api('/admin/permission-matrix/') })
  const [edits, setEdits] = useState<Record<string, Record<string, string[]>>>({})
  const [saving, setSaving] = useState('')
  const roles: any[] = matrix.data?.roles ?? []
  const apps: any[] = matrix.data?.apps ?? []
  const grantsOf = (role: any) => edits[role.code] ?? role.grants ?? {}
  const cycle = (role: any, app: string) => {
    const cur = grantsOf(role)[app] ?? []
    const next = cur.length === 0 ? ['read'] : cur.includes('write') ? [] : ['read', 'write']
    setEdits((e) => ({ ...e, [role.code]: { ...grantsOf(role), [app]: next } }))
  }
  const save = async (role: any, grants: Record<string, string[]>) => {
    setSaving(role.code)
    try {
      await api(`/admin/permission-matrix/${role.code}/`, { method: 'PUT', body: JSON.stringify({ grants }) })
      toast(`Permissions saved for ${role.label} — in effect immediately`)
      setEdits((e) => { const n = { ...e }; delete n[role.code]; return n })
      qc.invalidateQueries({ queryKey: ['permission-matrix'] })
    } catch (err: any) { toast(`Save failed: ${errMsg(err)}`, false) } finally { setSaving('') }
  }
  const cellStyle = (acts: string[]): React.CSSProperties => acts.includes('write')
    ? { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }
    : acts.includes('read')
      ? { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }
      : { background: 'transparent', color: 'var(--muted)', border: '1px dashed var(--border)' }
  return (<div>
    <Section title="Roles & Permissions — module access matrix" sub="Click a cell to cycle access: – none → R read → RW read + write. Changes take effect immediately for every user with that role. Station scope is assigned per user (Users page) and always applies on top of these grants.">
      {matrix.isLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading matrix…</p>}
      {matrix.isError && <p className="text-sm" style={{ color: 'var(--danger, #b91c1c)' }}>Could not load the matrix: {errMsg(matrix.error)}</p>}
      {matrix.data && (<div className="overflow-x-auto">
        <table className="text-xs w-full" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
          <thead><tr>
            <th className="text-left p-2 sticky left-0" style={{ background: 'var(--card)', minWidth: 170 }}>Module</th>
            {roles.map((r: any) => (<th key={r.code} className="p-2 text-center" style={{ minWidth: 86 }}>
              <div className="font-semibold" style={{ color: 'var(--text)' }}>{r.label}</div>
              <div style={{ color: 'var(--muted)' }}>{r.user_count} user{r.user_count === 1 ? '' : 's'}{r.customized ? ' · custom' : ''}</div>
            </th>))}
          </tr></thead>
          <tbody>
            {apps.map((a: any) => (<tr key={a.app}>
              <td className="p-2 font-medium sticky left-0" style={{ background: 'var(--card)', color: 'var(--text)' }}>{a.label}</td>
              {roles.map((r: any) => {
                const acts = grantsOf(r)[a.app] ?? []
                const lockedRole = r.code === 'admin'
                return (<td key={r.code} className="text-center">
                  <button type="button" disabled={lockedRole} title={lockedRole ? 'Admin always has full access' : `${r.label} — ${a.label}: click to change`}
                    onClick={() => cycle(r, a.app)}
                    className="rounded-md px-2 py-1 font-bold w-12"
                    style={lockedRole ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' } : cellStyle(acts)}>
                    {lockedRole ? 'RW' : acts.includes('write') ? 'RW' : acts.includes('read') ? 'R' : '–'}
                  </button>
                </td>)
              })}
            </tr>))}
          </tbody>
        </table>
      </div>)}
      {Object.keys(edits).length > 0 && (<div className="flex flex-wrap gap-2 mt-3 items-center">
        <span className="text-xs font-semibold" style={{ color: 'var(--warning, #b45309)' }}>Unsaved changes:</span>
        {roles.filter((r: any) => edits[r.code]).map((r: any) => (
          <span key={r.code} className="flex gap-1 items-center">
            <button className="btn !py-1 !px-2 text-xs" disabled={saving === r.code} onClick={() => save(r, grantsOf(r))}>
              {saving === r.code ? 'Saving…' : `Save ${r.label}`}</button>
            <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setEdits((e) => { const n = { ...e }; delete n[r.code]; return n })}>Discard</button>
          </span>))}
      </div>)}
    </Section>
    <Section title="Role directory & hard locks" sub="Who holds each role is managed on the Users, Roles & Signatures page. The rules below are enforced in code and cannot be changed from this matrix.">
      <div className="grid gap-2 md:grid-cols-2">
        {roles.map((r: any) => (<div key={r.code} className="rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <b className="text-sm" style={{ color: 'var(--text)' }}>{r.label}</b>
            <span className="flex gap-1 items-center">
              {r.customized && <Badge value="customized" />}
              <Badge value={`${r.user_count} users`} />
              {r.customized && <button className="btn-ghost !py-0.5 !px-2 text-[11px]" disabled={saving === r.code}
                onClick={() => save(r, r.defaults)}>Reset to defaults</button>}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{r.description || '—'}</p>
        </div>))}
      </div>
      <ul className="list-disc pl-5 mt-3 text-xs space-y-1" style={{ color: 'var(--muted)' }}>
        {(matrix.data?.locked ?? []).map((note: string, i: number) => <li key={i}>{note}</li>)}
      </ul>
    </Section>
  </div>)
}
