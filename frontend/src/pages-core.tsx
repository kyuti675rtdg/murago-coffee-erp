import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, queueOffline, queuedRecords, clearQueued, uuidv7 } from './api'
import { Badge, Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'
import { useT } from './i18n'
import { FarmerProfile } from './pages-farm'
import L from 'leaflet'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const STAGES = ['harvesting_sorting', 'receiving', 'pulping', 'fermenting', 'washing', 'drying', 'conditioning', 'dry_milling', 'bag_marking', 'packing', 'storing', 'exporting']
export function Dashboard() {
  const t = useT()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard/') })
  const d = q.data
  const snapshotsQ = useList('/dashboard-snapshots/'); const snapshots = snapshotsQ.rows
  if (!d) return q.isError ? <div className="card text-sm" style={{color:'var(--danger)'}}>{t('Dashboard unavailable', 'ዳሽቦርዱ አይገኝም')}: {errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>{t('Retry', 'እንደገና ሞክር')}</button></div> : <div className="space-y-2">{[0,1,2].map(i=><div key={i} className="skeleton h-20 w-full" />)}</div>
  const stageData = STAGES.map((s) => ({ stage: s.replace(/_/g, ' '), lots: d.lots_by_stage?.[s] ?? 0 }))
  const kpis: [string, any][] = [[t('Lots in pipeline', 'በሂደት ላይ ያሉ ሎቶች'), d.lots_total], [t('Cherry procured (kg)', 'የተገዛ ቼሪ (ኪ.ግ)'), d.cherry_procured_kg], [t('Warehouse stock (kg)', 'የመጋዘን ክምችት (ኪ.ግ)'), d.warehouse_stock_kg], [t('Open export contracts', 'ክፍት የኤክስፖርት ውሎች'), d.open_contracts], [t('Committed stock (kg)', 'የተወሰነ ክምችት (ኪ.ግ)'), d.committed_kg], [t('Farmers registered', 'የተመዘገቡ ገበሬዎች'), d.farmers], [t('Containers open', 'ክፍት ኮንቴይነሮች'), d.containers_open], [t('Avg fuel ratio (L/kg)', 'አማካይ የነዳጅ ሬሽዮ (ሊ/ኪ.ግ)'), String(d.avg_fuel_ratio).slice(0, 7)], [t('Avg water ratio (L/kg)', 'አማካይ የውሃ ሬሽዮ (ሊ/ኪ.ግ)'), String(d.avg_water_ratio).slice(0, 7)], [t('Fuel anomalies', 'የነዳጅ ያልተለመዱ ሁኔታዎች'), d.fuel_anomalies], [t('Water anomalies', 'የውሃ ያልተለመዱ ሁኔታዎች'), d.water_anomalies]]
  const insightKpis: [string, any, string][] = [
    [t('Procurement spend', 'የግዥ ወጪ'), `ETB ${Number(d.procurement_cost_etb ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, t('Total paid value of recorded cherry procurement', 'የተመዘገበ የቼሪ ግዥ ጠቅላላ ዋጋ')],
    [t('Avg buying price', 'አማካይ የግዥ ዋጋ'), `ETB ${Number(d.avg_price_per_kg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg`, t('Use this to watch daily price discipline by site', 'የዋጋ ቁጥጥርን በጣቢያ ለመከታተል ይጠቀሙ')],
    [t('Active supplying farmers', 'ንቁ አቅራቢ ገበሬዎች'), `${d.active_farmers ?? 0} · ${d.active_farmer_pct ?? 0}%`, t('Registered farmers who delivered coffee in the data set', 'ቡና ካቀረቡ የተመዘገቡ ገበሬዎች')],
    [t('Pending voucher approvals', 'በመጠበቅ ላይ የወረቀት ማጽደቆች'), d.pending_vouchers ?? 0, t('Procurement vouchers waiting for the next approval step', 'ለሚቀጥለው ማጽደቅ የሚጠብቁ የግዥ ወረቀቶች')],
    [t('Pending bonus approvals', 'በመጠበቅ ላይ የጉርሻ ማጽደቆች'), d.pending_bonuses ?? 0, t('Calculated farmer bonuses waiting for approval', 'ማጽደቅ የሚጠብቁ የተሰሉ የገበሬ ጉርሻዎች')],
    [t('Approved bonus liability', 'የጸደቀ የጉርሻ ክፍያ'), `ETB ${Number(d.bonus_liability_etb ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, t('Approved but unpaid farmer bonus exposure', 'የጸደቀ ግን ያልተከፈለ የገበሬ ጉርሻ')],
    [t('Top supplying site', 'ምርጥ አቅራቢ ጣቢያ'), d.top_station_code ?? '—', `${Number(d.top_station_kg ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg ${t('collected', 'ተሰብስቧል')}`],
    [t('Unallocated stock', 'ያልተመደበ ክምችት'), `${Math.max(0, Number(d.warehouse_stock_kg ?? 0) - Number(d.committed_kg ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`, t('Warehouse stock not yet committed to contracts', 'እስካሁን ለውሎች ያልተወሰነ የመጋዘን ክምችት')],
  ]
    return (<div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">{kpis.map(([l, v]) => <div key={l} className="card"><div className="lbl">{l}</div><div className="kpi">{String(v)}</div></div>)}</div>
    <Section title={t('Management Insights — decision KPIs', 'የአመራር ግንዛቤዎች — የውሳኔ KPIዎች')} sub={t('Live financial, supply-base, approval and bonus indicators for management decisions — not static demo numbers.', 'ለአመራር ውሳኔዎች የቀጥታ ፋይናንስ፣ አቅርቦት፣ ማጽደቅ እና የጉርሻ አመልካቾች — ቋሚ የሙከራ ቁጥሮች አይደለም።')}>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {insightKpis.map(([l, v, hint]) => <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="lbl">{l}</div><div className="text-xl font-bold mt-1">{String(v)}</div><div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{hint}</div></div>)}
      </div>
    </Section>
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
  const t = useT()
  const _q = useList('/farmers/'); const rows = _q.rows
  const stationsQ = useList('/stations/'); const stations = stationsQ.rows
  const plots = useList('/farm-plots/')
  const certs = useList('/certifications/')
  const dds = useList('/eudr-statements/')
  const toast = useToast(); const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const [filters, setFilters] = useState<any>({ station: '', region: '', zone: '', variety: '', status: '', kyc: '' })
  const stationById = useMemo(() => new Map(stations.map((s: any) => [s.id, s])), [stations])
  const enriched = useMemo(() => rows.map((r: any) => {
    const st = stationById.get(r.station)
    return {
      ...r,
      site_code: st?.code ?? '',
      washing_station: st?.name ?? '',
      registration_date: String(r.created_at ?? '').slice(0, 10),
      status_label: r.is_active ? 'Active' : 'Inactive',
    }
  }), [rows, stationById])
  const options = (key: string) => Array.from(new Set(enriched.map((r: any) => String(r[key] ?? '')).filter(Boolean))).sort()
  const filtered = useMemo(() => enriched.filter((r: any) =>
    (!filters.station || r.station === filters.station) &&
    (!filters.region || r.region === filters.region) &&
    (!filters.zone || r.zone === filters.zone) &&
    (!filters.variety || r.coffee_variety === filters.variety) &&
    (!filters.status || r.status_label === filters.status) &&
    (!filters.kyc || r.kyc_status === filters.kyc)
  ), [enriched, filters])
  const nextCode = useMemo(() => {
    const nums = rows.map((r: any) => parseInt(String(r.farmer_code).replace(/\D/g, ''), 10)).filter((n: number) => !Number.isNaN(n))
    return `FRM-2026-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`
  }, [rows])
  const empty = { farmer_code: '', full_name: '', gender: '', phone: '', national_id_number: '', station: '', region: 'Sidama', zone: '', woreda: '', kebele: '', coffee_variety: '', family_size: 5, coffee_tree_count: 0, total_plot_ha: 0, annual_cherry_cap_kg: 0, kyc_status: 'pending', is_active: true }
  const [f, setF] = useState<any>(empty)
  const payload = (x: any) => ({
    farmer_code: x.farmer_code || nextCode, full_name: x.full_name, gender: x.gender || '', phone: x.phone || '',
    national_id_number: x.national_id_number || '', station: x.station, region: x.region || '', zone: x.zone || '',
    woreda: x.woreda || '', kebele: x.kebele || '', coffee_variety: x.coffee_variety || '',
    family_size: Number(x.family_size || 1), coffee_tree_count: Number(x.coffee_tree_count || 0),
    total_plot_ha: x.total_plot_ha || 0, annual_cherry_cap_kg: x.annual_cherry_cap_kg || 0,
    kyc_status: x.kyc_status || 'pending', is_active: !!x.is_active,
  })
  const save = useMutation({
    mutationFn: () => editing
      ? api(`/api/farmers/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(payload(f)) })
      : post('/farmers/', payload(f)),
    onSuccess: () => { toast(editing ? t('Farmer updated', 'የገበሬ መረጃ ተዘምኗል') : t('Farmer registered', 'ገበሬ ተመዝግቧል')); setEditing(null); setF(empty); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const remove = useMutation({
    mutationFn: (r: any) => api(`/api/farmers/${r.id}/`, { method: 'DELETE' }),
    onSuccess: (d: any) => { toast(d?.detail ?? t('Farmer deleted', 'ገበሬ ተሰርዟል')); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const startEdit = (r: any) => {
    setEditing(r); setF({ ...empty, ...r })
    setTimeout(() => document.getElementById('farmer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const startAdd = () => {
    setEditing(null); setF({ ...empty, farmer_code: nextCode })
    setTimeout(() => document.getElementById('farmer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const onStation = (stationId: string) => {
    const st = stationById.get(stationId)
    setF((prev: any) => ({ ...prev, station: stationId, region: st?.region || prev.region, woreda: st?.woreda || prev.woreda, zone: st?.code === 'BEN' ? 'Eastern Sidama' : st?.code === 'MUR' ? 'Central Sidama' : prev.zone }))
  }
  if (selected) return <FarmerProfile farmerId={selected.id} onBack={() => setSelected(null)} />
  const totalProduction = filtered.reduce((sum: number, r: any) => sum + Number(r.total_production_kg || 0), 0)
  const totalFarmHa = filtered.reduce((sum: number, r: any) => sum + Number(r.total_plot_ha || 0), 0)
  const activeCount = filtered.filter((r: any) => r.is_active).length
  const verifiedCount = filtered.filter((r: any) => r.kyc_status === 'verified').length
  const listingKpis: [string, any][] = [
    [t('Registered farmers', 'የተመዘገቡ ገበሬዎች'), filtered.length],
    [t('Active farmers', 'ንቁ ገበሬዎች'), activeCount],
    [t('KYC verified', 'ማንነታቸው የተረጋገጠ'), filtered.length ? `${Math.round(verifiedCount / filtered.length * 100)}%` : '0%'],
    [t('Total production', 'ጠቅላላ ምርት'), `${totalProduction.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`],
    [t('Coffee farm area', 'የቡና እርሻ ስፋት'), `${totalFarmHa.toLocaleString(undefined, { maximumFractionDigits: 1 })} ha`],
    [t('Avg production / farmer', 'አማካይ ምርት / ገበሬ'), filtered.length ? `${Math.round(totalProduction / filtered.length).toLocaleString()} kg` : '0 kg'],
  ]
  return (<div>
    {((view === 'all' || view === 'directory') && (<div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {listingKpis.map(([l, v]) => <div key={l} className="card !p-3"><div className="lbl">{l}</div><div className="text-lg font-bold mt-1">{String(v)}</div></div>)}
      </div>
      <Section title={t('Farmer Listing', 'የገበሬዎች ዝርዝር ሰንጠረዥ')} sub={t('Search, filter, sort and paginate the live outgrower registry. Use View for the full profile, Edit to update the record, or Delete — farmers with history are safely deactivated instead of erased.', 'የቀጥታ አቅራቢ መዝገብን ይፈልጉ፣ ያጣሩ፣ ያደራጁ እና ገጽ ይቀይሩ። ሙሉ መገለጫ ለማየት View፣ መረጃ ለማዘመን Edit፣ ለመሰረዝ Delete ይጠቀሙ — ታሪክ ያላቸው ገበሬዎች ከመጥፋት ይልቅ ይሰናከላሉ።')}
        action={<button className="btn !py-2" onClick={startAdd}>+ {t('Add Farmer', 'ገበሬ ጨምር')}</button>}>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
          <Field label={t('Site / Station', 'ጣቢያ')}><select className="inp" value={filters.station} onChange={(e) => setFilters({ ...filters, station: e.target.value })}><option value="">{t('All sites', 'ሁሉም ጣቢያዎች')}</option>{stations.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></Field>
          <Field label={t('Region', 'ክልል')}><select className="inp" value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })}><option value="">{t('All regions', 'ሁሉም ክልሎች')}</option>{options('region').map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label={t('Zone', 'ዞን')}><select className="inp" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}><option value="">{t('All zones', 'ሁሉም ዞኖች')}</option>{options('zone').map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label={t('Coffee Variety', 'የቡና ዝርያ')}><select className="inp" value={filters.variety} onChange={(e) => setFilters({ ...filters, variety: e.target.value })}><option value="">{t('All varieties', 'ሁሉም ዝርያዎች')}</option>{options('coffee_variety').map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label={t('Status', 'ሁኔታ')}><select className="inp" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">{t('All statuses', 'ሁሉም ሁኔታዎች')}</option><option value="Active">{t('Active', 'ንቁ')}</option><option value="Inactive">{t('Inactive', 'ዝግ')}</option></select></Field>
          <Field label="KYC"><select className="inp" value={filters.kyc} onChange={(e) => setFilters({ ...filters, kyc: e.target.value })}><option value="">{t('All KYC', 'ሁሉም KYC')}</option><option value="verified">{t('Verified', 'ተረጋግጧል')}</option><option value="pending">{t('Pending', 'በመጠበቅ ላይ')}</option><option value="rejected">{t('Rejected', 'ውድቅ')}</option></select></Field>
        </div>
        {(filters.station || filters.region || filters.zone || filters.variety || filters.status || filters.kyc) && <button className="btn-ghost !py-1 text-xs mb-2" onClick={() => setFilters({ station: '', region: '', zone: '', variety: '', status: '', kyc: '' })}>{t('Clear filters', 'ማጣሪያዎችን አጽዳ')}</button>}
        <T state={_q} rows={filtered} pageSize={12} searchPlaceholder={t('Search ID, name, phone, kebele…', 'በመለያ፣ ስም፣ ስልክ፣ ቀበሌ ፈልግ…')} onRowClick={(r: any) => setSelected(r)} cols={[
          ['farmer_code', t('Farmer ID', 'የገበሬ መለያ')], ['full_name', t('Full Name', 'ሙሉ ስም')], ['phone', t('Phone Number', 'ስልክ ቁጥር')],
          ['region', t('Region', 'ክልል')], ['zone', t('Zone', 'ዞን')], ['woreda', t('Woreda', 'ወረዳ')], ['kebele', t('Kebele', 'ቀበሌ')],
          ['site_code', t('Site', 'ጣቢያ')], ['washing_station', t('Washing Station', 'ማጠቢያ ጣቢያ')], ['total_plot_ha', t('Farm Size', 'የእርሻ መጠን')],
          ['coffee_variety', t('Coffee Variety', 'የቡና ዝርያ')], ['total_production_kg', t('Total Production', 'ጠቅላላ ምርት')],
          ['registration_date', t('Registration Date', 'የምዝገባ ቀን')], ['status_label', t('Status', 'ሁኔታ')], ['actions', t('Actions', 'እርምጃዎች')],
        ]} renderCell={(r: any, k: string) => {
          if (k === 'farmer_code') return <b>{r.farmer_code}</b>
          if (k === 'total_plot_ha') return `${Number(r.total_plot_ha || 0).toFixed(2)} ha`
          if (k === 'total_production_kg') return `${Number(r.total_production_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`
          if (k === 'status_label') return <span className="inline-flex flex-col items-start gap-1"><Badge value={r.is_active ? 'active' : 'inactive'} /><span className="text-[11px]" style={{ color: 'var(--muted)' }}>KYC: {r.kyc_status}</span></span>
          if (k === 'actions') return <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setSelected(r)}>{t('View', 'ዝርዝር')}</button>
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => startEdit(r)}>{t('Edit', 'አርትዕ')}</button>
            <button className="btn-ghost !px-2 !py-1 text-xs" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm(`${t('Delete/deactivate farmer', 'ገበሬን መሰረዝ/ማሰናከል')} ${r.farmer_code} — ${r.full_name}?`)) remove.mutate(r) }}>{t('Delete', 'ሰርዝ')}</button>
          </span>
          return undefined
        }} />
      </Section>
      <div id="farmer-form">
      <Section title={editing ? t('Edit Farmer', 'ገበሬ አርትዕ') : t('Add Farmer — Registration Form', 'ገበሬ ጨምር — የምዝገባ ቅጽ')} sub={t('Complete farmer registration and location profile. Farmer ID is suggested automatically for new records; annual cap follows the registered farm size and tree count.', 'ሙሉ የገበሬ ምዝገባ እና የቦታ መገለጫ። ለአዲስ መዝገብ የገበሬ መለያ በራስ-ሰር ይጠቆማል።')}>
        <div className="grid md:grid-cols-4 gap-2">
          <Field label={t('Farmer ID', 'የገበሬ መለያ')}><input className="inp" value={f.farmer_code} onChange={(e) => setF({ ...f, farmer_code: e.target.value })} placeholder={nextCode} /></Field>
          <Field label={t('Full name', 'ሙሉ ስም')}><input className="inp" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label={t('Gender', 'ጾታ')}><select className="inp" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option><option value="male">{t('Male', 'ወንድ')}</option><option value="female">{t('Female', 'ሴት')}</option></select></Field>
          <Field label={t('Phone Number', 'ስልክ ቁጥር')}><input className="inp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0911…" /></Field>
          <Field label={t('National ID number', 'የብሔራዊ መታወቂያ ቁጥር')}><input className="inp" value={f.national_id_number} onChange={(e) => setF({ ...f, national_id_number: e.target.value })} /></Field>
          <Field label={t('Site / Washing Station', 'ጣቢያ / ማጠቢያ ጣቢያ')}><StationSelect value={f.station} onChange={onStation} /></Field>
          <Field label={t('Region', 'ክልል')}><input className="inp" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></Field>
          <Field label={t('Zone', 'ዞን')}><input className="inp" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} /></Field>
          <Field label={t('Woreda', 'ወረዳ')}><input className="inp" value={f.woreda} onChange={(e) => setF({ ...f, woreda: e.target.value })} /></Field>
          <Field label={t('Kebele', 'ቀበሌ')}><input className="inp" value={f.kebele} onChange={(e) => setF({ ...f, kebele: e.target.value })} /></Field>
          <Field label={t('Coffee Variety', 'የቡና ዝርያ')}><input className="inp" value={f.coffee_variety} onChange={(e) => setF({ ...f, coffee_variety: e.target.value })} placeholder="74110 / 74112 / Heirloom Kurume" /></Field>
          <Field label={t('Family size', 'የቤተሰብ ብዛት')}><input className="inp" type="number" value={f.family_size} onChange={(e) => setF({ ...f, family_size: e.target.value })} /></Field>
          <Field label={t('Coffee trees', 'የቡና ዛፎች')}><input className="inp" type="number" value={f.coffee_tree_count} onChange={(e) => setF({ ...f, coffee_tree_count: e.target.value })} /></Field>
          <Field label={t('Farm Size (ha)', 'የእርሻ መጠን (ሄክታር)')}><input className="inp" type="number" step="0.01" value={f.total_plot_ha} onChange={(e) => setF({ ...f, total_plot_ha: e.target.value })} /></Field>
          <Field label={t('Annual cherry cap (kg)', 'ዓመታዊ የቼሪ ገደብ (ኪ.ግ)')}><input className="inp" type="number" value={f.annual_cherry_cap_kg} onChange={(e) => setF({ ...f, annual_cherry_cap_kg: e.target.value })} /></Field>
          <Field label={t('KYC status', 'የማንነት ሁኔታ')}><select className="inp" value={f.kyc_status} onChange={(e) => setF({ ...f, kyc_status: e.target.value })}><option value="pending">{t('Pending', 'በመጠበቅ ላይ')}</option><option value="verified">{t('Verified', 'ተረጋግጧል')}</option><option value="rejected">{t('Rejected', 'ውድቅ ተደርጓል')}</option></select></Field>
          <Field label={t('Status', 'ሁኔታ')}><select className="inp" value={f.is_active ? 'active' : 'inactive'} onChange={(e) => setF({ ...f, is_active: e.target.value === 'active' })}><option value="active">{t('Active', 'ንቁ')}</option><option value="inactive">{t('Inactive', 'ዝግ')}</option></select></Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn" disabled={!f.full_name || !f.station || save.isPending} onClick={() => save.mutate()}>{editing ? t('Save changes', 'ለውጦችን አስቀምጥ') : t('Register farmer', 'ገበሬ መዝግብ')}</button>
          {editing && <button className="btn-ghost" onClick={() => { setEditing(null); setF(empty) }}>{t('Cancel edit', 'አርትዕ ሰርዝ')}</button>}
          {(!f.full_name || !f.station) && <span className="text-xs self-center" style={{ color: 'var(--muted)' }}>{t('Full name and station are required.', 'ሙሉ ስም እና ጣቢያ ያስፈልጋሉ።')}</span>}
        </div>
      </Section>
      </div>
    </div>))}
    {((view === 'all' || view === 'gis') && (<Section title={t('Farm GIS & EUDR — Map, Plots & Documents', 'የእርሻ ካርታና EUDR — ካርታ፣ ቦታዎችና ሰነዶች')} sub={t('GeoJSON farm polygons · certifications · Due Diligence Statements', 'የእርሻ ካርታዎች · የምስክር ወረቀቶች · የEUDR መግለጫዎች')}>
      <FarmerMap plots={plots.rows} />
      <div className="grid md:grid-cols-2 gap-4 mt-3"><div><h4 className="font-semibold text-sm mb-1">{t('Farm plots', 'የእርሻ ቦታዎች')}</h4><T state={plots} rows={plots.rows} cols={[['plot_name', t('Plot', 'ቦታ')], ['area_ha', t('ha', 'ሄክታር')], ['elevation_m', t('Elev. m', 'ቁመት ሜ')], ['coffee_variety', t('Variety', 'ዝርያ')], ['deforestation_free', t('Deforestation-free', 'ከደን መፍረስ ነፃ')]]} /></div>
        <div><h4 className="font-semibold text-sm mb-1">{t('Certifications & EUDR DDS', 'የምስክር ወረቀቶችና EUDR')}</h4><T state={certs} rows={certs.rows} cols={[['cert_type', t('Type', 'ዓይነት')], ['certificate_number', t('Cert #', 'ቁጥር')], ['expires_on', t('Expires', 'የሚያልቅበት')]]} /><T state={dds} rows={dds.rows} cols={[['reference_number', t('DDS ref', 'የDDS ማጣቀሻ')], ['status', t('Status', 'ሁኔታ')]]} /></div></div>
    </Section>))}</div>)
}


export function Collection({ view = 'all' }: { view?: string } = {}) {
  const t = useT()
  const centers = useList('/collection-centers/'); const agents = useList('/agent-assignments/')
  const intakes = useList('/cherry-intakes/'); const farmers = useList('/farmers/')
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ intake_number: '', farmer: '', center: '', station: '', intake_date: new Date().toISOString().slice(0, 10), coffee_variety: 'Heirloom', gross_kg: 0, tare_kg: 0, floater_deduction_pct: 0, unit_price: 85, qr_receipt_code: '' })
  const net = Math.max(0, (Number(f.gross_kg) || 0) - (Number(f.tare_kg) || 0))
  const payable = net * (1 - (Number(f.floater_deduction_pct) || 0) / 100)
  const create = useMutation({ mutationFn: () => post('/cherry-intakes/', { ...f, qr_receipt_code: f.qr_receipt_code || `QR-${f.intake_number}` }), onSuccess: (d: any) => { toast(`${t('Intake saved', 'መቀበያ ተቀምጧል')} — ${t('net', 'የተጣራ')} ${d.net_kg} ${t('kg', 'ኪ.ግ')}, ${t('payable', 'የሚከፈል')} ${d.payable_kg} ${t('kg', 'ኪ.ግ')}, ${t('total', 'ጠቅላላ')} ${d.total_amount} ETB · QR: ${d.qr_receipt_code}`); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'centers') && (<Section title="Collection Center & Agent Assignment"><T state={centers} rows={centers.rows} cols={[['code', 'Code'], ['name', 'Center'], ['altitude_m', 'Altitude m'], ['is_active', 'Active']]} /><h4 className="font-semibold text-sm mt-3">{t('Field purchasing agent assignments', 'የመስክ ግዥ ወኪል ምደባዎች')}</h4><T state={agents} rows={agents.rows} cols={[['valid_from','Valid from'],['valid_to','Valid to']]} /></Section>))}
    {((view === 'all' || view === 'intake') && (<Section title="Daily Cherry Intake & Scale Terminal — Weighbridge" sub="net = gross − tare · payable = net − floatation deduction · QR intake receipt issued on save">
      <div className="grid md:grid-cols-4 gap-2">
        <Field label="Intake #"><input className="inp" value={f.intake_number} onChange={(e) => setF({ ...f, intake_number: e.target.value })} placeholder="INT-2026-0002" /></Field>
        <Field label="Farmer"><select className="inp" value={f.farmer} onChange={(e) => setF({ ...f, farmer: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{farmers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.farmer_code} — {x.full_name}</option>)}</select></Field>
        <Field label="Center"><select className="inp" value={f.center} onChange={(e) => setF({ ...f, center: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{centers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Station"><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
        <Field label="Gross (kg)"><input className="inp" type="number" value={f.gross_kg} onChange={(e) => setF({ ...f, gross_kg: e.target.value })} /></Field>
        <Field label="Tare (kg)"><input className="inp" type="number" value={f.tare_kg} onChange={(e) => setF({ ...f, tare_kg: e.target.value })} /></Field>
        <Field label="Floatation deduction %"><input className="inp" type="number" value={f.floater_deduction_pct} onChange={(e) => setF({ ...f, floater_deduction_pct: e.target.value })} /></Field>
        <Field label="Unit price (ETB/kg)"><input className="inp" type="number" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-sm"><span>{t('Net', 'የተጣራ')}: <b>{net.toFixed(2)} {t('kg', 'ኪ.ግ')}</b></span><span>{t('Payable', 'የሚከፈል')}: <b>{payable.toFixed(2)} {t('kg', 'ኪ.ግ')}</b></span><span>{t('Total', 'ጠቅላላ')}: <b>{(payable * (Number(f.unit_price) || 0)).toFixed(2)} ETB</b></span>
        <button className="btn" onClick={() => create.mutate()}>{t('Record intake + print QR receipt', 'መቀበያ መዝግብ + የQR ደረሰኝ አትም')}</button></div>
      <div className="mt-3"><T state={intakes} rows={intakes.rows} cols={[['intake_number', 'Intake #'], ['intake_date', 'Date'], ['gross_kg', 'Gross'], ['tare_kg', 'Tare'], ['net_kg', 'Net'], ['payable_kg', 'Payable'], ['total_amount', 'Total ETB'], ['qr_receipt_code', 'QR receipt']]} /></div>
    </Section>))}</div>)
}


export function Procurement({ view = 'all' }: { view?: string } = {}) {
  const t = useT()
  const prices = useList('/daily-prices/'); const vouchers = useList('/purchase-vouchers/'); const grns = useList('/grns/'); const suppliers = useList('/suppliers/')
  const toast = useToast(); const qc = useQueryClient()
  const [p, setP] = useState<any>({ station: '', price_date: new Date().toISOString().slice(0, 10), product: 'cherry', grade: '1', price_per_kg: 85 })
  const create = useMutation({ mutationFn: () => post('/daily-prices/', p), onSuccess: () => { toast(t('Daily price set', 'የዕለት ዋጋ ተቀምጧል')); qc.invalidateQueries() }, onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'prices') && (<Section title="Daily Buying Price & Supplier Configuration">
      <div className="grid md:grid-cols-5 gap-2"><Field label="Station"><StationSelect value={p.station} onChange={(v: string) => setP({ ...p, station: v })} /></Field>
        <Field label="Date"><input className="inp" type="date" value={p.price_date} onChange={(e) => setP({ ...p, price_date: e.target.value })} /></Field>
        <Field label="Product"><select className="inp" value={p.product} onChange={(e) => setP({ ...p, product: e.target.value })}><option value="cherry">{t('Red cherry', 'ቀይ ቼሪ')}</option><option value="parchment">{t('Parchment', 'በቆሎ')}</option></select></Field>
        <Field label="Grade"><input className="inp" value={p.grade} onChange={(e) => setP({ ...p, grade: e.target.value })} /></Field>
        <Field label="Price / kg"><input className="inp" type="number" value={p.price_per_kg} onChange={(e) => setP({ ...p, price_per_kg: e.target.value })} /></Field></div>
      <button className="btn mt-2" onClick={() => create.mutate()}>{t('Set daily price', 'የዕለት ዋጋ አስቀምጥ')}</button>
      <T state={prices} rows={prices.rows} cols={[['price_date', 'Date'], ['product', 'Product'], ['grade', 'Grade'], ['price_per_kg', 'ETB/kg']]} />
      <h4 className="font-semibold text-sm mt-3">{t('Suppliers (ACRs / cooperatives)', 'አቅራቢዎች (ACR / ህብረት ሥራ)')}</h4><T state={suppliers} rows={suppliers.rows} cols={[['code', 'Code'], ['name', 'Supplier'], ['supplier_type', 'Type'], ['phone', 'Phone']]} />
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
  const t = useT()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard/') })
  const snapshotsQ = useList('/dashboard-snapshots/'); const snapshots = snapshotsQ.rows
  const contracts = useList('/sales-contracts/')
  const d = q.data
  if (!d) return q.isError
    ? <div className="card text-sm" style={{ color: 'var(--danger)' }}>{t('Financial position unavailable', 'የፋይናንስ ሁኔታ አይገኝም')}: {errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>Retry</button></div>
    : <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
  const kpis: [string, any][] = [[t('Open export contracts', 'ክፍት የኤክስፖርት ውሎች'), d.open_contracts], [t('Committed stock (kg)', 'የተወሰነ ክምችት (ኪ.ግ)'), d.committed_kg], [t('Warehouse stock (kg)', 'የመጋዘን ክምችት (ኪ.ግ)'), d.warehouse_stock_kg], [t('Unallocated stock (kg)', 'ያልተመደበ ክምችት (ኪ.ግ)'), (Number(d.warehouse_stock_kg) - Number(d.committed_kg)).toFixed(2)], [t('Cherry procured (kg)', 'የተገዛ ቼሪ (ኪ.ግ)'), d.cherry_procured_kg], [t('Containers open', 'ክፍት ኮንቴይነሮች'), d.containers_open]]
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
