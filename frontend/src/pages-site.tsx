/* Sites & Washing Station Management + Admin Site Performance dashboard.
   Data: /api/site-performance/ (comparison) and
   /api/site-performance/{id}/ (drill-down: profile, series, top farmers,
   staff, lots, equipment) — all computed live from operational tables. */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Building2, MapPin, Plus, Save } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, post } from './api'
import { useT } from './i18n'
import { Badge, Field, Section, T, errMsg, useList, useToast } from './ui'

const kg = (v: any) => `${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`
const money = (v: any) => `ETB ${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

function AlertChips({ alerts }: { alerts: any[] }) {
  if (!alerts?.length) return <span className="text-xs" style={{ color: 'var(--ok, #16a34a)' }}>✓</span>
  return (<span className="inline-flex flex-wrap gap-1">{alerts.map((a, i) => (
    <span key={i} title={a.message} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full"
      style={{ background: a.level === 'critical' ? 'var(--danger)' : a.level === 'warning' ? '#d97706' : 'var(--muted)', color: '#fff' }}>
      <AlertTriangle size={10} />{a.level === 'critical' ? '!' : a.level === 'warning' ? '▲' : 'i'}
    </span>))}</span>)
}

/* ---------------- Sites directory + profile ---------------- */
export function Sites() {
  const t = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const perf = useQuery({ queryKey: ['site-performance'], queryFn: () => api('/api/site-performance/') })
  const stations = useList('/stations/')
  const byCode = new Map((perf.data?.stations ?? []).map((s: any) => [s.code, s]))
  const rows = stations.rows.map((s: any) => ({ ...s, perf: byCode.get(s.code) }))
  if (openId) return <SiteProfile stationId={openId} onBack={() => setOpenId(null)} />
  return (<div>
    <Section title={t('All sites & stations', 'ሁሉም ጣቢያዎች')} sub={t('Click a site to open its full profile — capacity, methods, equipment, utilities, staff, operations and performance', 'ሙሉ መገለጫ ለመክፈት ጣቢያውን ይጫኑ — አቅም፣ ዘዴዎች፣ መሳሪያዎች፣ አገልግሎቶች፣ ሠራተኞች፣ ሥራዎች እና አፈጻጸም')}>
      <T state={stations} rows={rows} onRowClick={(r: any) => setOpenId(r.id)} cols={[
        ['code', t('Code', 'ኮድ')], ['name', t('Site', 'ጣቢያ')], ['station_type', t('Type', 'ዓይነት')],
        ['region', t('Region', 'ክልል')], ['altitude_m', t('Altitude m', 'ቁመት ሜ')],
        ['daily_cherry_capacity_kg', t('Capacity kg/day', 'አቅም ኪ.ግ/ቀን')],
      ]} renderCell={(r: any, k: string) => k === 'code' ? <b>{r.code}</b>
        : k === 'station_type' ? <Badge value={r.station_type} />
        : k === 'daily_cherry_capacity_kg' ? kg(r.daily_cherry_capacity_kg)
        : undefined} />
    </Section>
    <Section title={t('At a glance', 'በጨረፍታ')} sub={t('Live operating figures per site (all recorded time)', 'የቀጥታ የሥራ አኃዞች (ሙሉ ጊዜ)')}>
      <T state={perf.isLoading ? { isLoading: true } : perf.isError ? { isError: true, error: perf.error, refetch: perf.refetch } : {}} rows={perf.data?.stations ?? []} onRowClick={(r: any) => setOpenId(r.station_id)} cols={[
        ['code', t('Code', 'ኮድ')], ['farmers', t('Farmers', 'ገበሬዎች')], ['collected_kg', t('Collected', 'የተሰበሰበ')],
        ['procurement_cost_etb', t('Procurement cost', 'የግዥ ወጪ')], ['yield_pct', t('Yield %', 'ውጤት %')],
        ['avg_quality', t('Avg quality', 'አማካይ ጥራት')], ['stock_kg', t('Stock', 'ክምችት')],
        ['efficiency_score', t('Efficiency', 'ብቃት')], ['alerts', t('Alerts', 'ማስጠንቅቂያዎች')],
      ]} renderCell={(r: any, k: string) => k === 'collected_kg' || k === 'stock_kg' ? kg(r[k])
        : k === 'procurement_cost_etb' ? money(r[k])
        : k === 'alerts' ? <AlertChips alerts={r.alerts} />
        : k === 'yield_pct' || k === 'efficiency_score' ? (r[k] == null ? '—' : r[k])
        : undefined} />
    </Section>
  </div>)
}

export function SiteProfile({ stationId, onBack }: { stationId: string; onBack: () => void }) {
  const t = useT()
  const [tab, setTab] = useState('overview')
  const q = useQuery({ queryKey: ['site-detail', stationId], queryFn: () => api(`/api/site-performance/${stationId}/`) })
  const workers = useList('/workers/')
  const stores = useList('/stores/')
  const d = q.data
  if (!d) return q.isError
    ? <div className="card text-sm" style={{ color: 'var(--danger)' }}>{errMsg(q.error)} <button className="btn-ghost !py-1 text-xs ml-2" onClick={() => q.refetch()}>{t('Retry', 'እንደገና ሞክር')}</button></div>
    : <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="skeleton h-24 w-full" />)}</div>
  const p = d.profile
  const siteWorkers = workers.rows.filter((w: any) => w.station === stationId)
  const siteStores = stores.rows.filter((s: any) => s.station === stationId)
  const tabs: [string, string][] = [
    ['overview', t('Overview', 'አጠቃላይ')], ['equipment', t('Equipment', 'መሳሪያዎች')],
    ['staff', t('Staff', 'ሠራተኞች')], ['procurement', t('Procurement', 'ግዥ')],
    ['production', t('Production', 'ምርት')], ['quality', t('Quality', 'ጥራት')],
    ['inventory', t('Inventory', 'ክምችት')], ['performance', t('Performance', 'አፈጻጸም')],
  ]
  const cards: [string, any][] = [
    [t('Farmers', 'ገበሬዎች'), d.farmers], [t('Collected', 'የተሰበሰበ'), kg(d.collected_kg)],
    [t('Procurement cost', 'የግዥ ወጪ'), money(d.procurement_cost_etb)],
    [t('Avg price / kg', 'አማካይ ዋጋ / ኪ.ግ'), `ETB ${d.avg_price_per_kg}`],
    [t('Yield', 'ውጤት'), d.yield_pct ? `${d.yield_pct}%` : '—'],
    [t('Avg quality', 'አማካይ ጥራት'), d.avg_quality ?? '—'],
    [t('Stock', 'ክምችት'), kg(d.stock_kg)],
    [t('Efficiency', 'ብቃት'), d.efficiency_score ?? '—'],
  ]
  return (<div>
    <button className="btn-ghost mb-3 inline-flex items-center gap-1" onClick={onBack}><ArrowLeft size={14} /> {t('All sites', 'ሁሉም ጣቢያዎች')}</button>
    <div className="card mb-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-lg font-bold flex items-center gap-2"><Building2 size={18} /> {p.code} — {p.name}</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {String(p.station_type).replace(/_/g, ' ')} · {p.region}{p.woreda ? ` · ${p.woreda}` : ''}{p.kebele ? ` · ${p.kebele}` : ''}
            {p.altitude_m ? ` · ${p.altitude_m} m` : ''}
            {p.latitude && p.longitude ? <> · <MapPin size={12} className="inline" /> {p.latitude}, {p.longitude} <a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=13/${p.latitude}/${p.longitude}`}>{t('Map', 'ካርታ')}</a></> : null}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {p.manager_name ? `${t('Manager', 'አስተዳዳሪ')}: ${p.manager_name} · ` : ''}{p.phone || ''} {p.email || ''}
            {p.established_year ? ` · ${t('Est.', 'ተመሠረተ')} ${p.established_year}` : ''}
          </p>
        </div>
        <AlertChips alerts={d.alerts} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {cards.map(([l, v]) => <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="lbl">{l}</div><div className="text-lg font-bold">{String(v)}</div></div>)}
      </div>
      {d.alerts?.length > 0 && <div className="mt-3 space-y-1">{d.alerts.map((a: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-1" style={{ color: a.level === 'critical' ? 'var(--danger)' : '#d97706' }}>
          <AlertTriangle size={12} /> {a.message}</p>))}</div>}
    </div>

    <div className="flex flex-wrap gap-1 mb-4">
      {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'btn !py-1.5 text-xs' : 'btn-ghost !py-1.5 text-xs'} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {tab === 'overview' && <ProfileEditor station={p} />}
    {tab === 'equipment' && <EquipmentTab stationId={stationId} rows={d.equipment ?? []} />}
    {tab === 'staff' && (<div>
      <Section title={t('System users assigned to this site', 'ለዚህ ጣቢያ የተመደቡ የሲስተም ተጠቃሚዎች')}>
        <T rows={d.staff ?? []} cols={[['username', t('User', 'ተጠቃሚ')], ['role_label', t('Role', 'ሚና')]]} />
      </Section>
      <Section title={t('Seasonal workers', 'የወቅት ሠራተኞች')}>
        <T state={workers} rows={siteWorkers} cols={[['worker_code', t('Worker ID', 'የሠራተኛ መለያ')], ['full_name', t('Name', 'ስም')], ['kind', t('Kind', 'ዓይነት')], ['wage_rate', t('Wage ETB', 'ደመወዝ ብር')], ['phone', t('Phone', 'ስልክ')]]} />
      </Section>
    </div>)}
    {tab === 'procurement' && (<Section title={t('Top supplying farmers', 'ምርጥ አቅራቢ ገበሬዎች')} sub={t('Ranked by delivered kg in the selected period (all time by default)', 'በተመረጠው ጊዜ ውስጥ በቀረበ ኪ.ግ ቅደም ተከተል')}>
      <T rows={d.top_farmers ?? []} cols={[['farmer_code', t('Farmer ID', 'የገበሬ መለያ')], ['full_name', t('Name', 'ስም')], ['deliveries', t('Deliveries', 'ማቅረቢያዎች')], ['kg', t('Kg', 'ኪ.ግ')], ['amount_etb', t('Amount ETB', 'መጠን ብር')]]}
        renderCell={(r: any, k: string) => k === 'kg' ? kg(r.kg) : k === 'amount_etb' ? money(r.amount_etb) : undefined} />
      <p className="text-sm mt-2">{t('Collections', 'መሰብሰቦች')}: <b>{d.intakes}</b> · {t('Centers', 'ማዕከላት')}: <b>{d.centers}</b> · {t('Avg price', 'አማካይ ዋጋ')}: <b>ETB {d.avg_price_per_kg}/kg</b></p>
    </Section>)}
    {tab === 'production' && (<Section title={t('Recent lots & conversion', 'የቅርብ ሎቶች እና ልወጣ')}>
      <T rows={d.recent_lots ?? []} cols={[['lot_code', t('Lot', 'ሎት')], ['process_type', t('Process', 'ዘዴ')], ['current_stage', t('Stage', 'ደረጃ')], ['cherry_kg', t('Cherry kg', 'የቼሪ ኪ.ግ')], ['parchment_kg', t('Parchment kg', 'የበቆሎ ኪ.ግ')], ['current_weight_kg', t('Current kg', 'የአሁን ኪ.ግ')]]} />
      <p className="text-sm mt-2">{t('Yield', 'ውጤት')}: <b>{d.yield_pct ? `${d.yield_pct}%` : '—'}</b> ({kg(d.cherry_in_kg)} → {kg(d.parchment_kg)})</p>
    </Section>)}
    {tab === 'quality' && (<Section title={t('Quality summary', 'የጥራት ማጠቃለያ')}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="lbl">{t('Average cupping score', 'አማካይ የቅምሻ ነጥብ')}</div><div className="text-lg font-bold">{d.avg_quality ?? '—'}</div></div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="lbl">{t('Cuppings recorded', 'የተመዘገቡ ቅምሻዎች')}</div><div className="text-lg font-bold">{d.cuppings}</div></div>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="lbl">{t('Fuel / water ratios', 'የነዳጅ / የውሃ ሬሽዮ')}</div><div className="text-lg font-bold">{d.fuel_ratio ?? '—'} / {d.water_ratio ?? '—'}</div></div>
      </div>
    </Section>)}
    {tab === 'inventory' && (<Section title={t('Stores at this site', 'በዚህ ጣቢያ ያሉ መጋዘኖች')}>
      <T state={stores} rows={siteStores} cols={[['name', t('Store', 'መጋዘን')], ['coffee_form', t('Form', 'ቅርጽ')]]} />
      <p className="text-sm mt-2">{t('Current stock (ledger)', 'የአሁኑ ክምችት (መዝገብ)')}: <b>{kg(d.stock_kg)}</b> · {t('Storage capacity', 'የማስቀመጫ አቅም')}: <b>{kg(p.storage_capacity_kg)}</b></p>
    </Section>)}
    {tab === 'performance' && (<Section title={t('Daily collections', 'የዕለት መሰብሰቦች')}>
      {d.daily_series?.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={d.daily_series.map((r: any) => ({ ...r, kgN: Number(r.kg) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <YAxis tick={{ fill: 'var(--muted)' }} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <Line type="monotone" dataKey="kgN" name={t('Collected kg', 'የተሰበሰበ ኪ.ግ')} stroke="var(--accent)" strokeWidth={2} dot={false} />
        </LineChart></ResponsiveContainer></div>
        : <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('No collections recorded yet.', 'ገና መሰብሰብ አልተመዘገበም።')}</p>}
      <p className="text-sm mt-2">{t('Capacity utilisation', 'የአቅም አጠቃቀም')}: <b>{d.capacity_utilization_pct ? `${d.capacity_utilization_pct}%` : '—'}</b> · {t('Capacity', 'አቅም')}: <b>{kg(d.capacity_kg_day)}/{t('day', 'ቀን')}</b> · {t('Efficiency score', 'የብቃት ነጥብ')}: <b>{d.efficiency_score ?? '—'}</b></p>
    </Section>)}
  </div>)
}

function ProfileEditor({ station }: { station: any }) {
  const t = useT(); const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ ...station, processing_methods: (station.processing_methods ?? []).join(', ') })
  const save = useMutation({
    mutationFn: () => api(`/api/stations/${station.id}/`, { method: 'PATCH', body: JSON.stringify({
      kebele: f.kebele, phone: f.phone, email: f.email, manager_name: f.manager_name,
      established_year: f.established_year ? Number(f.established_year) : null,
      daily_cherry_capacity_kg: f.daily_cherry_capacity_kg || 0, drying_bed_count: Number(f.drying_bed_count || 0),
      drying_capacity_kg: f.drying_capacity_kg || 0, storage_capacity_kg: f.storage_capacity_kg || 0,
      fermentation_tank_count: Number(f.fermentation_tank_count || 0),
      processing_methods: String(f.processing_methods || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      water_source: f.water_source, water_tank_capacity_litres: f.water_tank_capacity_litres || 0,
      power_source: f.power_source, has_generator: !!f.has_generator,
      generator_capacity_kva: f.generator_capacity_kva || null, internet_type: f.internet_type,
      profile_notes: f.profile_notes,
    }) }),
    onSuccess: () => { toast(t('Site profile saved', 'የጣቢያ መገለጫ ተቀምጧል')); qc.invalidateQueries() },
    onError: (e) => toast(errMsg(e), false),
  })
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return (<div>
    <Section title={t('Capacity & processing', 'አቅም እና ማዘጋጀት')}>
      <div className="grid md:grid-cols-3 gap-2">
        <Field label={t('Daily cherry capacity (kg)', 'የዕለት የቼሪ አቅም (ኪ.ግ)')}><input className="inp" type="number" value={f.daily_cherry_capacity_kg} onChange={set('daily_cherry_capacity_kg')} /></Field>
        <Field label={t('Drying beds', 'የማድረቂያ አልጋዎች')}><input className="inp" type="number" value={f.drying_bed_count} onChange={set('drying_bed_count')} /></Field>
        <Field label={t('Drying capacity (kg)', 'የማድረቅ አቅም (ኪ.ግ)')}><input className="inp" type="number" value={f.drying_capacity_kg} onChange={set('drying_capacity_kg')} /></Field>
        <Field label={t('Storage capacity (kg)', 'የማስቀመጫ አቅም (ኪ.ግ)')}><input className="inp" type="number" value={f.storage_capacity_kg} onChange={set('storage_capacity_kg')} /></Field>
        <Field label={t('Fermentation tanks', 'የማብላላት ታንኮች')}><input className="inp" type="number" value={f.fermentation_tank_count} onChange={set('fermentation_tank_count')} /></Field>
        <Field label={t('Processing methods (comma separated)', 'የማዘጋጀት ዘዴዎች (በኮማ ይለዩ)')}><input className="inp" value={f.processing_methods} onChange={set('processing_methods')} placeholder="washed, natural, honey" /></Field>
      </div>
    </Section>
    <Section title={t('Utilities & contacts', 'አገልግሎቶች እና አድራሻዎች')}>
      <div className="grid md:grid-cols-3 gap-2">
        <Field label={t('Water source', 'የውሃ ምንጭ')}><input className="inp" value={f.water_source ?? ''} onChange={set('water_source')} /></Field>
        <Field label={t('Water tank (litres)', 'የውሃ ታንክ (ሊትር)')}><input className="inp" type="number" value={f.water_tank_capacity_litres} onChange={set('water_tank_capacity_litres')} /></Field>
        <Field label={t('Power source', 'የኃይል ምንጭ')}><input className="inp" value={f.power_source ?? ''} onChange={set('power_source')} /></Field>
        <Field label={t('Generator capacity (kVA)', 'የጀነሬተር አቅም (kVA)')}><input className="inp" type="number" value={f.generator_capacity_kva ?? ''} onChange={set('generator_capacity_kva')} /></Field>
        <Field label={t('Internet', 'ኢንተርኔት')}><input className="inp" value={f.internet_type ?? ''} onChange={set('internet_type')} /></Field>
        <Field label={t('Has generator', 'ጀነሬተር አለው')}><input type="checkbox" checked={!!f.has_generator} onChange={set('has_generator')} /></Field>
        <Field label={t('Site manager', 'የጣቢያ አስተዳዳሪ')}><input className="inp" value={f.manager_name ?? ''} onChange={set('manager_name')} /></Field>
        <Field label={t('Phone', 'ስልክ')}><input className="inp" value={f.phone ?? ''} onChange={set('phone')} /></Field>
        <Field label="Email"><input className="inp" value={f.email ?? ''} onChange={set('email')} /></Field>
        <Field label={t('Kebele', 'ቀበሌ')}><input className="inp" value={f.kebele ?? ''} onChange={set('kebele')} /></Field>
        <Field label={t('Established year', 'የተመሠረተበት ዓመት')}><input className="inp" type="number" value={f.established_year ?? ''} onChange={set('established_year')} /></Field>
      </div>
      <Field label={t('Notes', 'ማስታወሻ')}><textarea className="inp" rows={2} value={f.profile_notes ?? ''} onChange={set('profile_notes')} /></Field>
      <button className="btn mt-3 inline-flex items-center gap-1" disabled={save.isPending} onClick={() => save.mutate()}><Save size={14} /> {t('Save site profile', 'የጣቢያ መገለጫ አስቀምጥ')}</button>
      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{t('GPS', 'GPS')}: {station.latitude ?? '—'}, {station.longitude ?? '—'} · {t('Altitude', 'ቁመት')}: {station.altitude_m ?? '—'} m</p>
    </Section>
  </div>)
}

function EquipmentTab({ stationId, rows }: { stationId: string; rows: any[] }) {
  const t = useT(); const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState<any>({ name: '', equipment_type: 'pulper', capacity_value: '', capacity_unit: 'kg/day', status: 'operational', next_maintenance_date: '' })
  const add = useMutation({
    mutationFn: () => post('/station-equipment/', { ...f, station: stationId, capacity_value: f.capacity_value === '' ? null : f.capacity_value, next_maintenance_date: f.next_maintenance_date || null }),
    onSuccess: () => { toast(t('Equipment added', 'መሳሪያ ተጨምሯል')); setF({ ...f, name: '' }); qc.invalidateQueries({ queryKey: ['site-detail', stationId] }) },
    onError: (e) => toast(errMsg(e), false),
  })
  return (<Section title={t('Equipment register', 'የመሳሪያ መዝገብ')} sub={t('Status and maintenance dates feed the site alerts on the performance dashboard', 'ሁኔታ እና የጥገና ቀናት ወደ አፈጻጸም ማስጠንቅቂያዎች ይገባሉ')}>
    <T rows={rows} cols={[['name', t('Equipment', 'መሳሪያ')], ['equipment_type', t('Type', 'ዓይነት')], ['capacity_value', t('Capacity', 'አቅም')], ['capacity_unit', t('Unit', 'መለኪያ')], ['status', t('Status', 'ሁኔታ')], ['next_maintenance_date', t('Next maintenance', 'ቀጣይ ጥገና')]]}
      renderCell={(r: any, k: string) => k === 'status' ? <Badge value={r.status} /> : undefined} />
    <div className="grid md:grid-cols-3 gap-2 mt-3">
      <Field label={t('Name', 'ስም')}><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Eco-Pulper C" /></Field>
      <Field label={t('Type', 'ዓይነት')}><select className="inp" value={f.equipment_type} onChange={(e) => setF({ ...f, equipment_type: e.target.value })}>
        {['pulper', 'generator', 'scale', 'moisture_meter', 'drying_bed', 'water_pump', 'huller', 'grader', 'vehicle', 'other'].map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
      <Field label={t('Status', 'ሁኔታ')}><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
        <option value="operational">operational</option><option value="maintenance">maintenance</option><option value="out_of_service">out of service</option></select></Field>
      <Field label={t('Capacity', 'አቅም')}><input className="inp" type="number" value={f.capacity_value} onChange={(e) => setF({ ...f, capacity_value: e.target.value })} /></Field>
      <Field label={t('Unit', 'መለኪያ')}><input className="inp" value={f.capacity_unit} onChange={(e) => setF({ ...f, capacity_unit: e.target.value })} /></Field>
      <Field label={t('Next maintenance', 'ቀጣይ ጥገና')}><input className="inp" type="date" value={f.next_maintenance_date} onChange={(e) => setF({ ...f, next_maintenance_date: e.target.value })} /></Field>
    </div>
    <button className="btn mt-2 inline-flex items-center gap-1" disabled={!f.name || add.isPending} onClick={() => add.mutate()}><Plus size={14} /> {t('Add equipment', 'መሳሪያ ጨምር')}</button>
  </Section>)
}

/* ---------------- Admin: Site Performance ---------------- */
export function SitePerformance() {
  const t = useT()
  const [range, setRange] = useState({ from: '', to: '' })
  const [applied, setApplied] = useState({ from: '', to: '' })
  const [typeFilter, setTypeFilter] = useState('')
  const [drillId, setDrillId] = useState<string | null>(null)
  const qs = new URLSearchParams()
  if (applied.from) qs.set('from', applied.from)
  if (applied.to) qs.set('to', applied.to)
  const perf = useQuery({ queryKey: ['site-performance', applied], queryFn: () => api(`/api/site-performance/${qs.toString() ? `?${qs}` : ''}`) })
  const rows = (perf.data?.stations ?? []).filter((s: any) => !typeFilter || s.station_type === typeFilter)
  const totals = perf.data?.totals
  const allAlerts = rows.flatMap((s: any) => (s.alerts ?? []).map((a: any) => ({ ...a, code: s.code })))
  if (drillId) return <SiteProfile stationId={drillId} onBack={() => setDrillId(null)} />
  return (<div>
    <Section title={t('Compare sites & stations', 'ጣቢያዎችን አወዳድር')} sub={t('Live from operations: collections, procurement, lots, cupping, stock, fuel & water registers', 'ከቀጥታ ሥራዎች፦ መሰብሰብ፣ ግዥ፣ ሎቶች፣ ቅምሻ፣ ክምችት፣ የነዳጅ እና የውሃ መዝገቦች')}>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <Field label={t('From', 'ከ')}><input className="inp" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
        <Field label={t('To', 'እስከ')}><input className="inp" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
        <Field label={t('Site type', 'የጣቢያ ዓይነት')}><select className="inp" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t('All types', 'ሁሉም ዓይነቶች')}</option>
          {['washing', 'dry_mill', 'collection_hub', 'central_warehouse', 'hq'].map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
        <button className="btn" onClick={() => setApplied(range)}>{t('Apply filters', 'ማጣሪያውን ተግብር')}</button>
        <button className="btn-ghost" onClick={() => { setRange({ from: '', to: '' }); setApplied({ from: '', to: '' }); setTypeFilter('') }}>{t('Reset', 'እንደገና ጀምር')}</button>
      </div>
      {totals && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {([[t('Sites', 'ጣቢያዎች'), totals.stations], [t('Farmers', 'ገበሬዎች'), totals.farmers],
          [t('Collected', 'የተሰበሰበ'), kg(totals.collected_kg)], [t('Procurement cost', 'የግዥ ወጪ'), money(totals.procurement_cost_etb)],
          [t('Open alerts', 'ክፍት ማስጠንቅቂያዎች'), totals.alerts]] as [string, any][]).map(([l, v]) => (
          <div key={l} className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}><div className="lbl">{l}</div><div className="text-lg font-bold">{String(v)}</div></div>))}
      </div>}
      <T state={perf.isLoading ? { isLoading: true } : perf.isError ? { isError: true, error: perf.error, refetch: perf.refetch } : {}}
        rows={rows} onRowClick={(r: any) => setDrillId(r.station_id)} cols={[
          ['code', t('Site', 'ጣቢያ')], ['farmers', t('Farmers', 'ገበሬዎች')], ['collected_kg', t('Collected kg', 'የተሰበሰበ ኪ.ግ')],
          ['procurement_cost_etb', t('Cost ETB', 'ወጪ ብር')], ['avg_price_per_kg', t('ETB/kg', 'ብር/ኪ.ግ')],
          ['yield_pct', t('Yield %', 'ውጤት %')], ['avg_quality', t('Quality', 'ጥራት')], ['stock_kg', t('Stock kg', 'ክምችት ኪ.ግ')],
          ['fuel_ratio', t('Fuel L/kg', 'ነዳጅ ሊ/ኪ.ግ')], ['capacity_utilization_pct', t('Capacity %', 'አቅም %')],
          ['efficiency_score', t('Efficiency', 'ብቃት')], ['alerts', t('Alerts', 'ማስጠንቅቂያዎች')],
        ]} renderCell={(r: any, k: string) => k === 'collected_kg' || k === 'stock_kg' ? kg(r[k])
          : k === 'procurement_cost_etb' ? money(r[k])
          : k === 'alerts' ? <AlertChips alerts={r.alerts} />
          : k === 'code' ? <b>{r.code}</b>
          : (r[k] == null ? '—' : undefined)} />
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{t('Click a site row to open the drill-down report (daily trend, top farmers, staff, lots, equipment).', 'ዝርዝር ሪፖርት ለመክፈት የጣቢያውን ረድፍ ይጫኑ።')}</p>
    </Section>

    <div className="grid lg:grid-cols-2 gap-4">
      <Section title={t('Collection volumes by site', 'የመሰብሰብ መጠን በጣቢያ')}>
        <div className="h-56"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.map((r: any) => ({ code: r.code, kg: Number(r.collected_kg) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="code" tick={{ fill: 'var(--muted)' }} /><YAxis tick={{ fill: 'var(--muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <Bar dataKey="kg" name={t('Collected kg', 'የተሰበሰበ ኪ.ግ')} fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
      </Section>
      <Section title={t('Quality & efficiency by site', 'ጥራት እና ብቃት በጣቢያ')}>
        <div className="h-56"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.map((r: any) => ({ code: r.code, quality: Number(r.avg_quality ?? 0), efficiency: Number(r.efficiency_score ?? 0) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="code" tick={{ fill: 'var(--muted)' }} /><YAxis tick={{ fill: 'var(--muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <Bar dataKey="quality" name={t('Avg quality', 'አማካይ ጥራት')} fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="efficiency" name={t('Efficiency', 'ብቃት')} fill="#d97706" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
      </Section>
    </div>

    <Section title={t('Alerts across all sites', 'በሁሉም ጣቢያዎች ያሉ ማስጠንቅቂያዎች')} sub={t('Generated live from fuel/water anomalies, yields, quality, capacity and equipment status', 'ከነዳጅ/ውሃ ልዩነቶች፣ ውጤት፣ ጥራት፣ አቅም እና ከመሳሪያ ሁኔታ በቀጥታ ይመነጫል')}>
      {allAlerts.length === 0
        ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('No active alerts.', 'ንቁ ማስጠንቅቂያ የለም።')}</p>
        : <div className="space-y-1">{allAlerts.map((a: any, i: number) => (
          <p key={i} className="text-sm flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: a.level === 'critical' ? 'var(--danger)' : a.level === 'warning' ? '#d97706' : 'var(--muted)', color: '#fff' }}>
              <AlertTriangle size={10} /> {a.code}</span> {a.message}</p>))}</div>}
    </Section>
  </div>)
}
