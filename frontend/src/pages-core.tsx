import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post, queueOffline, queuedRecords, clearQueued, uuidv7 } from './api'
import { Badge, Field, Section, StationSelect, T, UserSelect, errMsg, useList, useToast } from './ui'
import { useT } from './i18n'
import { FarmerProfile } from './pages-farm'
import L from 'leaflet'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award, Boxes, Cherry, ClipboardCheck, Coffee, FileText, Fuel, Package, Scale, TrendingUp, Users, Wallet, Warehouse } from 'lucide-react'

const STAGES = ['harvesting_sorting', 'receiving', 'pulping', 'fermenting', 'washing', 'drying', 'conditioning', 'dry_milling', 'bag_marking', 'packing', 'storing', 'exporting']
export function Dashboard() {
  const t = useT()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard/') })
  const d = q.data
  const perfQ = useQuery({ queryKey: ['site-performance', 'dashboard'], queryFn: () => api('/api/site-performance/') })
  const snapshotsQ = useList('/dashboard-snapshots/'); const snapshots = snapshotsQ.rows
  if (!d) return q.isError ? <div className="card text-sm" style={{ color: 'var(--danger)' }}>{t('Dashboard unavailable', 'ዳሽቦርዱ አይገኝም')}: {errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>{t('Retry', 'እንደገና ሞክር')}</button></div> : <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="skeleton h-24 w-full" />)}</div>
  const fmt = (v: any, dec = 0) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: dec, minimumFractionDigits: dec })
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const stock = Number(d.warehouse_stock_kg ?? 0); const committed = Number(d.committed_kg ?? 0)
  const allocPct = stock > 0 ? Math.min(100, Math.round(committed / stock * 100)) : 0
  const trend = (d.collection_trend ?? []).map((x: any) => ({ date: String(x.date).slice(5), kg: Number(x.kg), amount: Number(x.amount) }))
  const stageData = STAGES.map((s) => ({ stage: s.replace(/_/g, ' '), lots: d.lots_by_stage?.[s] ?? 0 })).filter((x) => x.lots > 0)
  const siteData = (perfQ.data?.stations ?? []).map((s: any) => ({ code: s.code, kg: Number(s.collected_kg ?? 0), quality: Number(s.avg_quality ?? s.quality_avg ?? 0), efficiency: Number(s.efficiency ?? 0) }))
  const PIE_COLORS = ['#d97706', '#92400e', '#65a30d', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#78716c', '#22c55e', '#e11d48', '#3b82f6']
  const heroStats: [string, string][] = [
    [t('Cherry procured', 'የተገዛ ቼሪ'), `${fmt(d.cherry_procured_kg)} kg`],
    [t('Procurement spend', 'የግዥ ወጪ'), `ETB ${fmt(d.procurement_cost_etb)}`],
    [t('Warehouse stock', 'የመጋዘን ክምችት'), `${fmt(d.warehouse_stock_kg)} kg`],
    [t('Active farmers', 'ንቁ ገበሬዎች'), `${d.active_farmer_pct ?? 0}%`],
  ]
  const cards: { icon: any; tint: string; label: string; value: string; hint: string; extra?: any }[] = [
    { icon: Package, tint: '#d97706', label: t('Lots in pipeline', 'በሂደት ላይ ያሉ ሎቶች'), value: fmt(d.lots_total), hint: t('Across all processing stages', 'በሁሉም የማምረት ደረጃዎች') },
    { icon: Scale, tint: '#0ea5e9', label: t('Avg buying price', 'አማካይ የግዥ ዋጋ'), value: `ETB ${fmt(d.avg_price_per_kg, 2)}`, hint: t('Per kg of payable cherry', 'በኪሎ ግራም የሚከፈል ቼሪ') },
    { icon: Award, tint: '#65a30d', label: t('Avg quality score', 'አማካይ የጥራት ነጥብ'), value: d.quality_avg ?? '—', hint: `${d.cupping_sessions ?? 0} ${t('cupping sessions scored', 'የቅምሻ ክፍለ-ጊዜዎች')}` },
    { icon: FileText, tint: '#8b5cf6', label: t('Open export contracts', 'ክፍት የኤክስፖርት ውሎች'), value: fmt(d.open_contracts), hint: `${fmt(d.containers_open)} ${t('containers in preparation', 'ኮንቴይነሮች በዝግጅት ላይ')}` },
    { icon: Boxes, tint: '#b45309', label: t('Committed stock', 'የተወሰነ ክምችት'), value: `${fmt(d.committed_kg)} kg`, hint: `${allocPct}% ${t('of warehouse stock allocated', 'የመጋዘን ክምችት ተመድቧል')}`, extra: <div className="h-1.5 rounded-full mt-2" style={{ background: 'var(--border)' }}><div className="h-1.5 rounded-full" style={{ width: `${allocPct}%`, background: '#b45309' }} /></div> },
    { icon: Wallet, tint: '#e11d48', label: t('Bonus liability', 'የጉርሻ ክፍያ'), value: `ETB ${fmt(d.bonus_liability_etb)}`, hint: `${d.pending_bonuses ?? 0} ${t('bonuses awaiting approval', 'ጉርሻዎች ማጽደቅ ይጠብቃሉ')}` },
    { icon: ClipboardCheck, tint: '#14b8a6', label: t('Pending approvals', 'በመጠበቅ ላይ ያሉ ማጽደቆች'), value: fmt((d.pending_vouchers ?? 0) + (d.pending_bonuses ?? 0)), hint: `${d.pending_vouchers ?? 0} ${t('vouchers', 'ወረቀቶች')} · ${d.pending_bonuses ?? 0} ${t('bonuses', 'ጉርሻዎች')}` },
    { icon: Fuel, tint: '#78716c', label: t('Fuel anomalies', 'የነዳጅ ያልተለመዱ ሁኔታዎች'), value: fmt(d.fuel_anomalies), hint: `${fmt(d.water_anomalies)} ${t('water anomalies · investigate promptly', 'የውሃ ያልተለመዱ ሁኔታዎች · ወዲያውኑ ይመርምሩ')}` },
  ]
  return (<div>
    {/* ——— Hero band ——— */}
    <div className="rounded-3xl p-5 sm:p-6 mb-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg, #451a03 0%, #92400e 48%, #d97706 100%)', boxShadow: 'var(--shadow-lg)' }}>
      <div className="absolute -right-8 -top-10 opacity-15"><Coffee size={190} /></div>
      <div className="relative flex flex-col lg:flex-row lg:items-end gap-5">
        <div className="min-w-[220px]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/70 font-semibold">{today}</div>
          <h2 className="text-2xl sm:text-[28px] font-bold leading-tight mt-1">{t('Operations at a glance', 'የሥራ ማጠቃለያ')}</h2>
          <p className="text-white/80 text-sm mt-1 max-w-sm">{t('Live Murago Coffee operations — procurement, processing, quality and export position, updated from the database in real time.', 'የሙራጎ ቡና የቀጥታ ሥራዎች — ግዥ፣ ማምረት፣ ጥራት እና የኤክስፖርት ሁኔታ፣ በቅጽበት ከዳታቤዙ የሚዘምን።')}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          {heroStats.map(([l, v]) => <div key={l} className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(4px)' }}><div className="text-[11px] uppercase tracking-wide text-white/75 font-medium">{l}</div><div className="text-lg sm:text-xl font-bold mt-0.5">{v}</div></div>)}
        </div>
      </div>
    </div>

    {/* ——— KPI cards ——— */}
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
      {cards.map((c) => { const Icon = c.icon; return (
        <div key={c.label} className="card !p-4 transition-shadow hover:shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div><div className="lbl">{c.label}</div><div className="text-[22px] leading-7 font-bold mt-1">{c.value}</div></div>
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: `${c.tint}1f`, color: c.tint }}><Icon size={18} /></span>
          </div>
          <div className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{c.hint}</div>
          {c.extra}
        </div>) })}
    </div>

    {/* ——— Charts row ——— */}
    <div className="grid xl:grid-cols-3 gap-4 mb-4">
      <Section className="xl:col-span-2" title={t('Collection Trend — last 14 days', 'የመሰብሰብ አዝማሚያ — ያለፉት 14 ቀናት')} sub={t('Payable cherry collected per day (kg) — hover for ETB value', 'በቀን የተሰበሰበ የሚከፈል ቼሪ (ኪ.ግ) — ለብር ዋጋ ላይ ያንዣብቡ')}>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}>
          <defs><linearGradient id="kgFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706" stopOpacity={0.45} /><stop offset="100%" stopColor="#d97706" stopOpacity={0.04} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10 }} formatter={(v: any, name: any) => name === 'kg' ? [`${fmt(v)} kg`, t('Collected', 'ተሰብስቧል')] : [`ETB ${fmt(v)}`, t('Value', 'ዋጋ')]} />
          <Area type="monotone" dataKey="kg" stroke="#d97706" strokeWidth={2.2} fill="url(#kgFill)" />
          <Area type="monotone" dataKey="amount" stroke="transparent" fill="transparent" />
        </AreaChart></ResponsiveContainer></div>
      </Section>
      <Section title={t('Lots by Processing Stage', 'ሎቶች በማምረት ደረጃ')} sub={t('Where coffee sits in the pipeline right now', 'ቡናው አሁን በሂደቱ የት እንዳለ')}>
        <div className="relative h-52"><ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie data={stageData} dataKey="lots" nameKey="stage" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
            {stageData.map((x, i) => <Cell key={x.stage} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10 }} />
        </PieChart></ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-2xl font-bold">{fmt(d.lots_total)}</div><div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('lots total', 'ጠቅላላ ሎቶች')}</div></div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">{stageData.map((x, i) => <span key={x.stage} className="inline-flex items-center gap-1.5 text-[11px] rounded-full px-2 py-0.5" style={{ background: 'var(--surface2)' }}><span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{x.stage} · <b>{x.lots}</b></span>)}</div>
      </Section>
    </div>

    {/* ——— Site comparison + decision signals ——— */}
    <div className="grid xl:grid-cols-3 gap-4 mb-4">
      <Section className="xl:col-span-2" title={t('Site Comparison', 'የጣቢያዎች ንጽጽር')} sub={t('Collected kg (bars) against average quality score (line) per site', 'የተሰበሰበ ኪ.ግ (አምዶች) ከአማካይ የጥራት ነጥብ (መስመር) ጋር በጣቢያ')}>
        {siteData.length ? <div className="h-60"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={siteData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="code" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis yAxisId="kg" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <YAxis yAxisId="q" orientation="right" domain={[60, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10 }} formatter={(v: any, name: any) => name === 'kg' ? [`${fmt(v)} kg`, t('Collected', 'ተሰብስቧል')] : [fmt(v, 2), t('Avg quality', 'አማካይ ጥራት')]} />
          <Bar yAxisId="kg" dataKey="kg" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={54} />
          <Line yAxisId="q" type="monotone" dataKey="quality" stroke="#65a30d" strokeWidth={2.4} dot={{ r: 4 }} />
        </ComposedChart></ResponsiveContainer></div>
        : <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('Loading site performance…', 'የጣቢያ አፈጻጸም በመጫን ላይ…')}</p>}
      </Section>
      <Section title={t('Decision Signals', 'የውሳኔ ምልክቶች')} sub={t('What needs management attention today', 'ዛሬ የአመራር ትኩረት የሚያስፈልጋቸው')}>
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={16} style={{ color: '#d97706' }} />{t('Top supplying site', 'ምርጥ አቅራቢ ጣቢያ')}</div><div className="text-xl font-bold mt-1">{d.top_station_code ?? '—'} · {fmt(d.top_station_kg)} kg</div><div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('Largest contributor to this season’s intake', 'የወቅቱን መቀበያ ትልቁን ድርሻ ያበረከተ')}</div></div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="flex items-center gap-2 text-sm font-semibold"><Users size={16} style={{ color: '#0ea5e9' }} />{t('Supply-base health', 'የአቅራቢ መሰረት ጤና')}</div><div className="text-xl font-bold mt-1">{d.active_farmers ?? 0} / {fmt(d.farmers)} {t('farmers delivering', 'ገበሬዎች እያቀረቡ')}</div><div className="text-[11px]" style={{ color: 'var(--muted)' }}>{d.active_farmer_pct}% {t('of the registered base supplied coffee', 'ከተመዘገበው መሰረት ቡና አቅርበዋል')}</div></div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="flex items-center gap-2 text-sm font-semibold"><Warehouse size={16} style={{ color: '#65a30d' }} />{t('Unallocated stock', 'ያልተመደበ ክምችት')}</div><div className="text-xl font-bold mt-1">{fmt(Math.max(0, stock - committed))} kg</div><div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('Available to promise against new contracts', 'ለአዳዲስ ውሎች ለመስጠት ዝግጁ')}</div></div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="flex items-center gap-2 text-sm font-semibold"><Cherry size={16} style={{ color: '#e11d48' }} />{t('Registered farmers', 'የተመዘገቡ ገበሬዎች')}</div><div className="text-xl font-bold mt-1">{fmt(d.farmers)}</div><div className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('Outgrower registry across all sites', 'በሁሉም ጣቢያዎች ላይ ያለ አቅራቢ መዝገብ')}</div></div>
        </div>
      </Section>
    </div>

    <Section title={t('Executive Financial & Contract Summary (snapshots)', 'የአስፈጻሚ ፋይናንስ እና የውል ማጠቃለያ (ቅጽበታዊ)')}><T state={snapshotsQ} rows={snapshots} cols={[['snapshot_date', 'Date'], ['cherry_procured_kg', 'Cherry kg'], ['warehouse_stock_kg', 'Stock kg'], ['cash_float_balance', 'Cash float'], ['landed_cost_per_kg', 'Landed cost/kg'], ['export_containers_open', 'Containers']]} /></Section>
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


function IntakeReceipt({ receipt, onClose }: { receipt: any; onClose: () => void }) {
  const t = useT()
  const [qr, setQr] = useState('')
  useEffect(() => {
    let live = true
    import('qrcode').then((m) => m.default.toDataURL(JSON.stringify({
      sys: 'MURAGO-ERP', receipt: receipt.qr_receipt_code, intake: receipt.intake_number,
      farmer: receipt.farmer_code, date: receipt.intake_date,
      payable_kg: receipt.payable_kg, amount_etb: receipt.total_amount,
    }), { width: 240, margin: 1 }).then((url: string) => { if (live) setQr(url) })).catch(() => {})
    return () => { live = false }
  }, [receipt])
  const fmt = (v: any, dec = 2) => Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })
  const rows: [string, string][] = [
    [t('Receipt No', 'የደረሰኝ ቁጥር'), receipt.intake_number],
    [t('Date', 'ቀን'), receipt.intake_date],
    [t('Farmer', 'ገበሬ'), `${receipt.farmer_code ?? ''} — ${receipt.farmer_name ?? ''}`],
    [t('Collection Center', 'የመሰብሰቢያ ማዕከል'), receipt.center_name ?? ''],
    [t('Station', 'ጣቢያ'), receipt.station_name ?? ''],
    [t('Coffee Variety', 'የቡና ዝርያ'), receipt.coffee_variety || '—'],
    [t('Gross Weight', 'ጠቅላላ ክብደት'), `${fmt(receipt.gross_kg)} kg`],
    [t('Tare', 'የእቃ ክብደት'), `${fmt(receipt.tare_kg)} kg`],
    [t('Net Weight', 'የተጣራ ክብደት'), `${fmt(receipt.net_kg)} kg`],
    [t('Floatation Deduction', 'የመንሳፈፍ ቅናሽ'), `${fmt(receipt.floater_deduction_pct)}%`],
    [t('Unit Price', 'የአንዱ ዋጋ'), `ETB ${fmt(receipt.unit_price)} / kg`],
  ]
  return (<div className="fixed inset-0 z-[80] flex items-center justify-center p-3 overflow-auto" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={onClose}>
    <div className="w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
      <div className="print-area rounded-2xl p-5 sm:p-6" style={{ background: '#fff', color: '#1c1917' }}>
        <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: '2px solid #d97706' }}>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: '#d97706', color: '#fff' }}><Coffee size={20} /></span>
            <div>
              <div className="font-extrabold tracking-wide text-[15px]">MURAGO COFFEE PROCESSING PLC</div>
              <div className="text-[11px]" style={{ color: '#57534e' }}>{receipt.station_name} · Bean Power Coffee</div>
            </div>
          </div>
          <div className="text-right">
            {qr ? <img src={qr} alt="Receipt QR code" className="w-[92px] h-[92px]" /> : <div className="w-[92px] h-[92px] rounded" style={{ background: '#f5f5f4' }} />}
            <div className="text-[9px] font-mono mt-0.5" style={{ color: '#57534e' }}>{receipt.qr_receipt_code}</div>
          </div>
        </div>
        <div className="text-center font-bold text-sm tracking-wide mt-3">{t('CHERRY INTAKE RECEIPT', 'የቼሪ መቀበያ ደረሰኝ')}</div>
        <div className="mt-3 space-y-1.5">
          {rows.map(([l, v]) => <div key={l} className="flex justify-between text-[13px]"><span style={{ color: '#57534e' }}>{l}</span><b className="text-right">{v}</b></div>)}
        </div>
        <div className="rounded-xl mt-4 px-4 py-3 flex items-center justify-between" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div><div className="text-[11px]" style={{ color: '#9a3412' }}>{t('PAYABLE WEIGHT', 'የሚከፈል ክብደት')}</div><div className="text-lg font-extrabold">{fmt(receipt.payable_kg)} kg</div></div>
          <div className="text-right"><div className="text-[11px]" style={{ color: '#9a3412' }}>{t('TOTAL AMOUNT', 'ጠቅላላ መጠን')}</div><div className="text-lg font-extrabold">ETB {fmt(receipt.total_amount)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6 text-[11px]" style={{ color: '#57534e' }}>
          <div><div className="pt-4" style={{ borderTop: '1px solid #a8a29e' }}>{t('Weighbridge Clerk — signature', 'የመለኪያ ሠራተኛ — ፊርማ')}</div></div>
          <div><div className="pt-4" style={{ borderTop: '1px solid #a8a29e' }}>{t('Farmer — signature', 'ገበሬ — ፊርማ')}</div></div>
        </div>
        <p className="text-[10px] text-center mt-4" style={{ color: '#78716c' }}>{t('Verify this receipt in the Murago ERP — Collection → Daily Cherry Intake. Keep your copy safe; payment is made against this receipt.', 'ይህን ደረሰኝ በሙራጎ ERP ውስጥ ያረጋግጡ — መቀበያ → የዕለት ቼሪ መቀበያ። ቅጂዎን በጥንቃቄ ያስቀምጡ፤ ክፍያ በዚህ ደረሰኝ ይከናወናል።')}</p>
      </div>
      <div className="no-print flex gap-2 mt-3">
        <button className="btn flex-1 justify-center !py-2.5" onClick={() => window.print()}>🖨 {t('Print Receipt', 'ደረሰኝ አትም')}</button>
        <button className="btn-ghost flex-1 justify-center !py-2.5" style={{ background: 'rgba(255,255,255,0.92)' }} onClick={onClose}>{t('Record Another Intake', 'ሌላ መቀበያ መዝግብ')}</button>
      </div>
    </div>
  </div>)
}


export function Collection({ view = 'all' }: { view?: string } = {}) {
  const t = useT()
  const centers = useList('/collection-centers/'); const agents = useList('/agent-assignments/')
  const intakes = useList('/cherry-intakes/'); const farmers = useList('/farmers/')
  const stationsList = useList('/stations/')
  const toast = useToast(); const qc = useQueryClient()
  const [receipt, setReceipt] = useState<any>(null)
  const [f, setF] = useState<any>({ intake_number: '', farmer: '', center: '', station: '', intake_date: new Date().toISOString().slice(0, 10), coffee_variety: 'Heirloom', gross_kg: 0, tare_kg: 0, floater_deduction_pct: 0, unit_price: 85, qr_receipt_code: '' })
  const net = Math.max(0, (Number(f.gross_kg) || 0) - (Number(f.tare_kg) || 0))
  const payable = net * (1 - (Number(f.floater_deduction_pct) || 0) / 100)
  const openReceipt = (d: any) => {
    const farmer = farmers.rows.find((x: any) => x.id === d.farmer)
    const center = centers.rows.find((x: any) => x.id === d.center)
    const station = stationsList.rows.find((x: any) => x.id === d.station)
    setReceipt({ ...d, farmer_code: farmer?.farmer_code ?? '', farmer_name: farmer?.full_name ?? '',
      center_name: center?.name ?? '', station_name: station ? `${station.code} — ${station.name}` : '' })
  }
  const onFarmer = (farmerId: string) => {
    const farmer = farmers.rows.find((x: any) => x.id === farmerId)
    setF({ ...f, farmer: farmerId, station: farmer?.station || f.station, coffee_variety: farmer?.coffee_variety || f.coffee_variety })
  }
  const create = useMutation({
    mutationFn: () => {
      const payload: any = { ...f }
      if (!payload.intake_number) delete payload.intake_number
      if (!payload.qr_receipt_code) delete payload.qr_receipt_code
      return post('/cherry-intakes/', payload)
    },
    onSuccess: (d: any) => { toast(`${t('Intake saved', 'መቀበያ ተቀምጧል')} — ${d.intake_number}`); openReceipt(d); setF({ ...f, intake_number: '', qr_receipt_code: '', gross_kg: 0, tare_kg: 0 }); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false) })
  return (<div>
    {((view === 'all' || view === 'centers') && (<Section title="Collection Center & Agent Assignment"><T state={centers} rows={centers.rows} cols={[['code', 'Code'], ['name', 'Center'], ['altitude_m', 'Altitude m'], ['is_active', 'Active']]} /><h4 className="font-semibold text-sm mt-3">{t('Field purchasing agent assignments', 'የመስክ ግዥ ወኪል ምደባዎች')}</h4><T state={agents} rows={agents.rows} cols={[['valid_from','Valid from'],['valid_to','Valid to']]} /></Section>))}
    {((view === 'all' || view === 'intake') && (<Section title="Daily Cherry Intake & Scale Terminal — Weighbridge" sub="net = gross − tare · payable = net − floatation deduction · QR intake receipt issued on save">
      <div className="grid md:grid-cols-4 gap-2">
        <Field label={t('Intake # (auto if blank)', 'የመቀበያ ቁጥር (ባዶ ከሆነ በራስ-ሰር)')}><input className="inp" value={f.intake_number} onChange={(e) => setF({ ...f, intake_number: e.target.value })} placeholder="INT-2026-…" /></Field>
        <Field label="Farmer"><select className="inp" value={f.farmer} onChange={(e) => onFarmer(e.target.value)}><option value="">{t('Select…', 'ምረጥ…')}</option>{farmers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.farmer_code} — {x.full_name}</option>)}</select></Field>
        <Field label="Center"><select className="inp" value={f.center} onChange={(e) => setF({ ...f, center: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{centers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Station"><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
        <Field label="Gross (kg)"><input className="inp" type="number" value={f.gross_kg} onChange={(e) => setF({ ...f, gross_kg: e.target.value })} /></Field>
        <Field label="Tare (kg)"><input className="inp" type="number" value={f.tare_kg} onChange={(e) => setF({ ...f, tare_kg: e.target.value })} /></Field>
        <Field label="Floatation deduction %"><input className="inp" type="number" value={f.floater_deduction_pct} onChange={(e) => setF({ ...f, floater_deduction_pct: e.target.value })} /></Field>
        <Field label="Unit price (ETB/kg)"><input className="inp" type="number" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm"><span>{t('Net', 'የተጣራ')}: <b>{net.toFixed(2)} {t('kg', 'ኪ.ግ')}</b></span><span>{t('Payable', 'የሚከፈል')}: <b>{payable.toFixed(2)} {t('kg', 'ኪ.ግ')}</b></span><span>{t('Total', 'ጠቅላላ')}: <b>{(payable * (Number(f.unit_price) || 0)).toFixed(2)} ETB</b></span>
        <button className="btn" disabled={!f.farmer || !f.center || !f.station || !(Number(f.gross_kg) > 0) || create.isPending} onClick={() => create.mutate()}>{create.isPending ? t('Saving…', 'በማስቀመጥ ላይ…') : t('Record intake + print QR receipt', 'መቀበያ መዝግብ + የQR ደረሰኝ አትም')}</button>
        {(!f.farmer || !f.center || !f.station || !(Number(f.gross_kg) > 0)) && <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('Select farmer, center and station, then enter the gross weight.', 'ገበሬ፣ ማዕከል እና ጣቢያ ይምረጡ፣ ከዚያ ጠቅላላ ክብደት ያስገቡ።')}</span>}</div>
      <div className="mt-3"><T state={intakes} rows={intakes.rows} cols={[['intake_number', 'Intake #'], ['intake_date', 'Date'], ['gross_kg', 'Gross'], ['tare_kg', 'Tare'], ['net_kg', 'Net'], ['payable_kg', 'Payable'], ['total_amount', 'Total ETB'], ['qr_receipt_code', 'QR receipt'], ['receipt', t('Receipt', 'ደረሰኝ')]]}
        renderCell={(r: any, k: string) => k === 'receipt' ? <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openReceipt(r)}>🧾 {t('Print', 'አትም')}</button> : undefined} /></div>
      {receipt && <IntakeReceipt receipt={receipt} onClose={() => setReceipt(null)} />}
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
