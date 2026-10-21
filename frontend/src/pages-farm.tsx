import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calculator, Check, Coins, Play, Plus, Save, X } from 'lucide-react'
import { api, post } from './api'
import { Badge, Field, Section, StationSelect, T, errMsg, useList, useToast } from './ui'
import { useT } from './i18n'

const fmt = (v: any) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }))

/* ============================ Farmer profile ============================ */
export function FarmerProfile({ farmerId, onBack }: { farmerId: string; onBack?: () => void }) {
  const t = useT()
  const q = useQuery({ queryKey: ['farmer-profile', farmerId], queryFn: () => api(`/api/farmers/${farmerId}/profile/`) })
  const [tab, setTab] = useState('overview')
  if (q.isLoading) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 w-full" />)}</div>
  if (q.isError || !q.data) return <div className="card text-sm" style={{ color: 'var(--danger)' }}>{t('Could not load the farmer profile', 'የገበሬውን መገለጫ መጫን አልተቻለም')}: {errMsg(q.error)}</div>
  const d = q.data; const f = d.farmer; const s = d.stats
  const tabs: [string, string, string][] = [
    ['overview', 'Overview', 'አጠቃላይ'], ['procurement', 'Procurement history', 'የግዥ ታሪክ'],
    ['quality', 'Quality', 'ጥራት'], ['payments', 'Payments', 'ክፍያዎች'], ['plans', 'Plans & bonuses', 'እቅዶችና ጉርሻ'],
  ]
  const stat = (label: string, value: any, unit = '') => (
    <div className="card !p-3"><div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: 'var(--text)' }}>{fmt(value)}{unit && <span className="text-xs font-medium ml-1" style={{ color: 'var(--muted)' }}>{unit}</span>}</div></div>)
  return (<div>
    {onBack && <button className="btn-ghost !py-1.5 text-xs mb-3" onClick={onBack}><ArrowLeft size={14} /> {t('Back to directory', 'ወደ ዝርዝሩ ተመለስ')}</button>}
    <Section title={`${f.farmer_code} — ${f.full_name}`} sub={`${t('Kebele', 'ቀበሌ')}: ${f.kebele || '—'} · ${t('Phone', 'ስልክ')}: ${f.phone || '—'} · ${t('National ID', 'የብሔራዊ መታወቂያ')}: ${f.national_id_number || '—'} · ${t('Family size', 'የቤተሰብ ብዛት')}: ${f.family_size ?? '—'}`}
      action={<Badge value={f.kyc_status} />}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stat(t('Total delivered', 'ጠቅላላ የቀረበ'), s.total_delivered_kg, t('kg', 'ኪ.ግ'))}
        {stat(t('Deliveries', 'ማድረሻዎች'), s.total_deliveries)}
        {stat(t('Procurement value', 'የግዥ ዋጋ'), s.total_procurement_value_etb, 'ETB')}
        {stat(t('Total paid', 'ጠቅላላ የተከፈለ'), s.total_paid_etb, 'ETB')}
        {stat(t('Avg quality score', 'አማካይ የጥራት ነጥብ'), s.avg_quality_score, '/ 100')}
        {stat(t('Cap use', 'የገደብ አጠቃቀም'), s.cap_utilization_pct, '%')}
        {stat(t('Coffee trees', 'የቡና ዛፎች'), f.coffee_tree_count)}
        {stat(t('Farm size', 'የእርሻ መጠን'), f.total_plot_ha, t('ha', 'ሄክታር'))}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-4">
        {tabs.map(([id, en, am]) => (
          <button key={id} onClick={() => setTab(id)} className="!px-3 !py-1.5 text-xs font-semibold rounded-lg"
            style={tab === id ? { background: 'var(--btn-bg)', color: 'var(--btn-text)' } : { border: '1px solid var(--border)', color: 'var(--muted)' }}>
            {t(en, am)}</button>))}
      </div>
      <div className="mt-3">
        {tab === 'overview' && (<div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="font-semibold text-sm mb-1">{t('Deliveries by year', 'በዓመት ማድረሻዎች')}</h4>
            <T rows={s.by_year} cols={[['year', t('Year', 'ዓመት')], ['deliveries', t('Deliveries', 'ማድረሻዎች')], ['kg', t('Kg', 'ኪ.ግ')], ['amount_etb', t('Amount ETB', 'መጠን ብር')]]} /></div>
          <div><h4 className="font-semibold text-sm mb-1">{t('Farm plots', 'የእርሻ ቦታዎች')}</h4>
            <T rows={d.plots} cols={[['plot_name', t('Plot', 'ቦታ')], ['area_ha', t('ha', 'ሄክታር')], ['elevation_m', t('Elev. m', 'ቁመት ሜ')], ['coffee_variety', t('Variety', 'ዝርያ')], ['tree_count', t('Trees', 'ዛፎች')], ['deforestation_free', t('Deforestation-free', 'ከደን መፍረስ ነፃ')]]} />
            <h4 className="font-semibold text-sm mt-3 mb-1">{t('Certifications', 'የምስክር ወረቀቶች')}</h4>
            <T rows={d.certifications} cols={[['cert_type', t('Type', 'ዓይነት')], ['certificate_number', t('Cert #', 'ቁጥር')], ['expires_on', t('Expires', 'የሚያልቅበት')]]} /></div>
        </div>)}
        {tab === 'procurement' && (<div>
          <h4 className="font-semibold text-sm mb-1">{t('Cherry deliveries (intakes)', 'የቼሪ ማድረሻዎች')}</h4>
          <T rows={d.procurement_history} cols={[['intake_number', t('Intake #', 'የመቀበያ ቁጥር')], ['intake_date', t('Date', 'ቀን')], ['coffee_variety', t('Variety', 'ዝርያ')], ['gross_kg', t('Gross kg', 'ጠቅላላ ኪ.ግ')], ['payable_kg', t('Payable kg', 'የሚከፈል ኪ.ግ')], ['unit_price', t('ETB/kg', 'ብር/ኪ.ግ')], ['total_amount', t('Total ETB', 'ጠቅላላ ብር')]]} />
          <h4 className="font-semibold text-sm mt-4 mb-1">{t('Purchase vouchers', 'የግዥ ወረቀቶች')}</h4>
          <T rows={d.vouchers} cols={[['voucher_number', t('Voucher', 'ወረቀት')], ['voucher_date', t('Date', 'ቀን')], ['quantity_kg', t('Qty kg', 'ኪ.ግ')], ['total_amount', t('Total ETB', 'ጠቅላላ ብር')], ['status', t('Status', 'ሁኔታ')]]} />
        </div>)}
        {tab === 'quality' && (<div>
          <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{t('Cupping results for lots that include this farmer\u2019s coffee. Average score feeds the bonus quality multiplier.', 'የዚህን ገበሬ ቡና የያዙ ሎቶች የቅምሻ ውጤቶች። አማካይ ነጥቡ የጉርሻውን የጥራት ማባዣ ይወስናል።')}</p>
          <T rows={d.quality} cols={[['lot_code', t('Lot', 'ሎት')], ['cupped_on', t('Cupped on', 'የተቀመሰበት')], ['total_score', t('Total score / 100', 'ጠቅላላ ነጥብ / 100')]]} />
        </div>)}
        {tab === 'payments' && (<div>
          <T rows={d.payments} cols={[['reference', t('Reference', 'ማጣቀሻ')], ['paid_on', t('Paid on', 'የተከፈለበት')], ['amount', t('Amount ETB', 'መጠን ብር')], ['method', t('Method', 'ዘዴ')], ['status', t('Status', 'ሁኔታ')]]} />
        </div>)}
        {tab === 'plans' && (<div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="font-semibold text-sm mb-1">{t('Season plans', 'የወቅት እቅዶች')}</h4>
            <T rows={d.plans} cols={[['plan_year', t('Year', 'ዓመት')], ['planned_cherry_kg', t('Planned kg', 'የታቀደ ኪ.ግ')], ['planned_new_trees', t('New trees', 'አዲስ ዛፎች')], ['status', t('Status', 'ሁኔታ')]]} /></div>
          <div><h4 className="font-semibold text-sm mb-1">{t('Bonus history', 'የጉርሻ ታሪክ')}</h4>
            <T rows={d.bonuses} cols={[['season_year', t('Season', 'ወቅት')], ['delivered_kg', t('Delivered kg', 'የቀረበ ኪ.ግ')], ['avg_quality_score', t('Quality', 'ጥራት')], ['gross_bonus_etb', t('Bonus ETB', 'ጉርሻ ብር')], ['status', t('Status', 'ሁኔታ')]]} /></div>
        </div>)}
      </div>
    </Section>
  </div>)
}

/* ============================ Farmer planning ============================ */
export function FarmerPlanning() {
  const t = useT(); const toast = useToast(); const qc = useQueryClient()
  const [year, setYear] = useState(2027)
  const plans = useList('/farmer-season-plans/')
  const farmers = useList('/farmers/')
  const rows = useMemo(() => plans.rows.filter((p: any) => Number(p.plan_year) === Number(year)), [plans.rows, year])
  const byId = useMemo(() => Object.fromEntries(farmers.rows.map((f: any) => [f.id, f])), [farmers.rows])
  const enriched = rows.map((p: any) => ({ ...p, farmer_label: byId[p.farmer] ? `${byId[p.farmer].farmer_code} — ${byId[p.farmer].full_name}` : p.farmer }))
  const [f, setF] = useState<any>({ farmer: '', plan_year: 2027, planned_cherry_kg: 0, planned_new_trees: 0, planned_area_expansion_ha: 0, inputs_support: '', agronomy_notes: '', status: 'draft' })
  const save = useMutation({
    mutationFn: () => f.id ? api(`/api/farmer-season-plans/${f.id}/`, { method: 'PATCH', body: JSON.stringify(f) }) : post('/farmer-season-plans/', f),
    onSuccess: () => { toast(t('Plan saved', 'እቅዱ ተቀምጧል')); setF({ farmer: '', plan_year: 2027, planned_cherry_kg: 0, planned_new_trees: 0, planned_area_expansion_ha: 0, inputs_support: '', agronomy_notes: '', status: 'draft' }); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const totals = rows.reduce((a: any, p: any) => ({ kg: a.kg + Number(p.planned_cherry_kg || 0), trees: a.trees + Number(p.planned_new_trees || 0) }), { kg: 0, trees: 0 })
  return (<div>
    <Section title={t('Next-Year Farmer Planning', 'የሚቀጥለው ዓመት የገበሬ እቅድ')} sub={t('One plan per farmer per year: production target, new trees, expansion and the support the farmer needs. Click a row to edit it.', 'ለእያንዳንዱ ገበሬ በዓመት አንድ እቅድ፦ የምርት ኢላማ፣ አዲስ ዛፎች፣ መስፋፋት እና የሚያስፈልገው ድጋፍ። ለማስተካከል ረድፉን ይጫኑ።')}
      action={<span className="text-sm" style={{ color: 'var(--muted)' }}>{year}: <b style={{ color: 'var(--text)' }}>{fmt(totals.kg)} {t('kg planned', 'ኪ.ግ ታቅዷል')}</b> · {fmt(totals.trees)} {t('new trees', 'አዲስ ዛፎች')}</span>}>
      <div className="flex gap-2 mb-2">
        {[2026, 2027, 2028].map((y) => (<button key={y} onClick={() => setYear(y)} className="!px-3 !py-1.5 text-xs font-semibold rounded-lg"
          style={year === y ? { background: 'var(--btn-bg)', color: 'var(--btn-text)' } : { border: '1px solid var(--border)', color: 'var(--muted)' }}>{y}</button>))}
      </div>
      <T state={plans} rows={enriched} onRowClick={(p: any) => setF({ ...p })}
        cols={[['farmer_label', t('Farmer', 'ገበሬ')], ['planned_cherry_kg', t('Planned kg', 'የታቀደ ኪ.ግ')], ['planned_new_trees', t('New trees', 'አዲስ ዛፎች')], ['planned_area_expansion_ha', t('Expansion ha', 'መስፋፋት ሄክታር')], ['inputs_support', t('Support needed', 'የሚያስፈልግ ድጋፍ')], ['status', t('Status', 'ሁኔታ')]]} />
    </Section>
    <Section title={f.id ? t('Edit plan', 'እቅድ አስተካክል') : t('New plan', 'አዲስ እቅድ')}>
      <div className="grid md:grid-cols-4 gap-2">
        <Field label={t('Farmer', 'ገበሬ')}><select className="inp" value={f.farmer} onChange={(e) => setF({ ...f, farmer: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{farmers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.farmer_code} — {x.full_name}</option>)}</select></Field>
        <Field label={t('Plan year', 'የእቅድ ዓመት')}><input className="inp" type="number" value={f.plan_year} onChange={(e) => setF({ ...f, plan_year: e.target.value })} /></Field>
        <Field label={t('Planned cherry (kg)', 'የታቀደ ቼሪ (ኪ.ግ)')}><input className="inp" type="number" value={f.planned_cherry_kg} onChange={(e) => setF({ ...f, planned_cherry_kg: e.target.value })} /></Field>
        <Field label={t('New trees', 'አዲስ ዛፎች')}><input className="inp" type="number" value={f.planned_new_trees} onChange={(e) => setF({ ...f, planned_new_trees: e.target.value })} /></Field>
        <Field label={t('Area expansion (ha)', 'የቦታ መስፋፋት (ሄክታር)')}><input className="inp" type="number" step="0.01" value={f.planned_area_expansion_ha} onChange={(e) => setF({ ...f, planned_area_expansion_ha: e.target.value })} /></Field>
        <Field label={t('Status', 'ሁኔታ')}><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="draft">{t('Draft', 'ረቂቅ')}</option><option value="submitted">{t('Submitted', 'ቀርቧል')}</option><option value="approved">{t('Approved', 'ጸድቋል')}</option></select></Field>
        <Field label={t('Support needed (seedlings, fertiliser, training, credit)', 'የሚያስፈልግ ድጋፍ (ችግኝ፣ ማዳበሪያ፣ ስልጠና፣ ብድር)')}><input className="inp" value={f.inputs_support} onChange={(e) => setF({ ...f, inputs_support: e.target.value })} /></Field>
        <Field label={t('Agronomy notes', 'የግብርና ማስታወሻ')}><input className="inp" value={f.agronomy_notes} onChange={(e) => setF({ ...f, agronomy_notes: e.target.value })} /></Field>
      </div>
      <button className="btn mt-3" onClick={() => save.mutate()}><Save size={15} /> {t('Save plan', 'እቅድ አስቀምጥ')}</button>
    </Section>
  </div>)
}

/* ============================ Bonus center & settings ============================ */
export function BonusCenter({ view = 'all' }: { view?: string } = {}) {
  const t = useT(); const toast = useToast(); const qc = useQueryClient()
  const schemes = useList('/bonus-schemes/')
  const tiers = useList('/bonus-tiers/')
  const calcs = useList('/bonus-calculations/')
  const farmers = useList('/farmers/')
  const [schemeId, setSchemeId] = useState('')
  const activeScheme = schemes.rows.find((s: any) => s.id === schemeId) ?? schemes.rows.find((s: any) => s.is_active) ?? schemes.rows[0]
  const byId = useMemo(() => Object.fromEntries(farmers.rows.map((f: any) => [f.id, f])), [farmers.rows])
  const calcRows = calcs.rows.filter((c: any) => !activeScheme || c.scheme === activeScheme.id)
    .map((c: any) => ({ ...c, farmer_label: byId[c.farmer] ? `${byId[c.farmer].farmer_code} — ${byId[c.farmer].full_name}` : c.farmer }))
  const totalBonus = calcRows.reduce((a: number, c: any) => a + Number(c.gross_bonus_etb || 0), 0)
  const act = useMutation({
    mutationFn: ({ id, action, body }: any) => post(`/bonus-calculations/${id}/${action}/`, body ?? {}),
    onSuccess: (_d, v: any) => { toast(v.action === 'pay' ? t('Bonus paid — disbursement created', 'ጉርሻው ተከፍሏል — የክፍያ መዝገብ ተፈጥሯል') : t('Done', 'ተጠናቋል')); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const run = useMutation({
    mutationFn: () => post('/bonus-calculations/run/', { scheme: activeScheme?.id }),
    onSuccess: (d: any) => { toast(`${t('Calculated', 'ተሰልቷል')}: ${d.calculated} ${t('farmers', 'ገበሬዎች')} · ${fmt(d.total_bonus_etb)} ETB`); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const [ns, setNs] = useState<any>({ name: '', season_year: 2027, is_active: true, min_eligible_kg: 300, quality_bands: '[{"min_score": 86, "multiplier": 1.25}, {"min_score": 83, "multiplier": 1.1}, {"min_score": 80, "multiplier": 1.0}]', notes: '' })
  const saveScheme = useMutation({
    mutationFn: () => { let bands: any = []; try { bands = JSON.parse(ns.quality_bands) } catch { throw new Error(t('Quality bands must be valid JSON', 'የጥራት ማባዣዎች ትክክለኛ JSON መሆን አለባቸው')) } return post('/bonus-schemes/', { ...ns, quality_bands: bands }) },
    onSuccess: () => { toast(t('Bonus scheme created', 'የጉርሻ እቅድ ተፈጥሯል')); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const [nt, setNt] = useState<any>({ scheme: '', from_kg: 0, to_kg: '', rate_per_kg: 0, label: '' })
  const saveTier = useMutation({
    mutationFn: () => post('/bonus-tiers/', { ...nt, scheme: nt.scheme || activeScheme?.id, to_kg: nt.to_kg === '' ? null : nt.to_kg }),
    onSuccess: () => { toast(t('Tier saved', 'ደረጃው ተቀምጧል')); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })

  const settingsBlock = (
    <div>
      <Section title={t('Bonus Schemes', 'የጉርሻ እቅዶች')} sub={t('A scheme defines who is eligible and how quality adjusts the payment. Tiers price the delivered kg.', 'እቅድ ማን ብቁ እንደሆነ እና ጥራት ክፍያውን እንዴት እንደሚያስተካክል ይወስናል። ደረጃዎች የቀረበውን ኪ.ግ ዋጋ ይሰጣሉ።')}>
        <T state={schemes} rows={schemes.rows} cols={[['name', t('Scheme', 'እቅድ')], ['season_year', t('Season', 'ወቅት')], ['min_eligible_kg', t('Min eligible kg', 'ዝቅተኛ ብቁ ኪ.ግ')], ['is_active', t('Active', 'ንቁ')]]} />
        <div className="grid md:grid-cols-4 gap-2 mt-3">
          <Field label={t('Scheme name', 'የእቅድ ስም')}><input className="inp" value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="2027 Season Loyalty & Quality Bonus" /></Field>
          <Field label={t('Season year', 'የወቅት ዓመት')}><input className="inp" type="number" value={ns.season_year} onChange={(e) => setNs({ ...ns, season_year: e.target.value })} /></Field>
          <Field label={t('Min eligible kg', 'ዝቅተኛ ብቁ ኪ.ግ')}><input className="inp" type="number" value={ns.min_eligible_kg} onChange={(e) => setNs({ ...ns, min_eligible_kg: e.target.value })} /></Field>
          <Field label={t('Notes', 'ማስታወሻ')}><input className="inp" value={ns.notes} onChange={(e) => setNs({ ...ns, notes: e.target.value })} /></Field>
        </div>
        <Field label={t('Quality bands (JSON: min cupping score → multiplier)', 'የጥራት ማባዣዎች (JSON: ዝቅተኛ የቅምሻ ነጥብ → ማባዣ)')}><input className="inp font-mono text-xs" value={ns.quality_bands} onChange={(e) => setNs({ ...ns, quality_bands: e.target.value })} /></Field>
        <button className="btn mt-2" onClick={() => saveScheme.mutate()}><Plus size={15} /> {t('Create scheme', 'እቅድ ፍጠር')}</button>
      </Section>
      <Section title={t('Kg Tiers', 'የኪሎ ግራም ደረጃዎች')} sub={t('Delivered (payable) kg in a tier earns that tier\u2019s ETB per kg. Leave "to kg" empty for the top tier.', 'በደረጃ ውስጥ ያለ የቀረበ (የሚከፈል) ኪ.ግ የዚያ ደረጃ ብር በኪ.ግ ያገኛል። ለላይኛው ደረጃ "እስከ ኪ.ግ" ባዶ ይተዉት።')}>
        <T state={tiers} rows={tiers.rows.filter((x: any) => !activeScheme || x.scheme === activeScheme.id)} cols={[['label', t('Tier', 'ደረጃ')], ['from_kg', t('From kg', 'ከ ኪ.ግ')], ['to_kg', t('To kg', 'እስከ ኪ.ግ')], ['rate_per_kg', t('ETB / kg', 'ብር / ኪ.ግ')]]} />
        <div className="grid md:grid-cols-5 gap-2 mt-3">
          <Field label={t('Scheme', 'እቅድ')}><select className="inp" value={nt.scheme || activeScheme?.id || ''} onChange={(e) => setNt({ ...nt, scheme: e.target.value })}>{schemes.rows.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label={t('Label', 'ስም')}><input className="inp" value={nt.label} onChange={(e) => setNt({ ...nt, label: e.target.value })} placeholder="Gold" /></Field>
          <Field label={t('From kg', 'ከ ኪ.ግ')}><input className="inp" type="number" value={nt.from_kg} onChange={(e) => setNt({ ...nt, from_kg: e.target.value })} /></Field>
          <Field label={t('To kg (empty = no limit)', 'እስከ ኪ.ግ (ባዶ = ገደብ የለም)')}><input className="inp" type="number" value={nt.to_kg} onChange={(e) => setNt({ ...nt, to_kg: e.target.value })} /></Field>
          <Field label={t('Rate ETB / kg', 'ብር / ኪ.ግ')}><input className="inp" type="number" step="0.01" value={nt.rate_per_kg} onChange={(e) => setNt({ ...nt, rate_per_kg: e.target.value })} /></Field>
        </div>
        <button className="btn mt-2" onClick={() => saveTier.mutate()}><Plus size={15} /> {t('Add tier', 'ደረጃ ጨምር')}</button>
      </Section>
    </div>)

  if (view === 'settings') return settingsBlock
  return (<div>
    <Section title={t('Farmer Bonus — Calculation & Approvals', 'የገበሬ ጉርሻ — ስሌት እና ማጽደቆች')}
      sub={t('Bonus = delivered kg × tier rate × quality multiplier. Run a calculation, review each farmer, approve, then pay — payment creates a real disbursement record.', 'ጉርሻ = የቀረበ ኪ.ግ × የደረጃ ዋጋ × የጥራት ማባዣ። ስሌት ያካሂዱ፣ እያንዳንዱን ገበሬ ይገምግሙ፣ ያጽድቁ፣ ከዚያ ይክፈሉ — ክፍያው እውነተኛ የክፍያ መዝገብ ይፈጥራል።')}
      action={<span className="text-sm" style={{ color: 'var(--muted)' }}>{t('Total', 'ጠቅላላ')}: <b style={{ color: 'var(--text)' }}>{fmt(totalBonus)} ETB</b> · {calcRows.length} {t('farmers', 'ገበሬዎች')}</span>}>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="min-w-[240px]"><Field label={t('Scheme', 'እቅድ')}><select className="inp" value={activeScheme?.id || ''} onChange={(e) => setSchemeId(e.target.value)}>{schemes.rows.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.season_year})</option>)}</select></Field></div>
        <button className="btn" onClick={() => run.mutate()} disabled={!activeScheme}><Play size={15} /> {t('Run calculation', 'ስሌት አካሂድ')}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full"><thead><tr>
          {[t('Farmer', 'ገበሬ'), t('Delivered kg', 'የቀረበ ኪ.ግ'), t('Quality', 'ጥራት'), t('Rate', 'ዋጋ'), t('× Quality', '× ጥራት'), t('Bonus ETB', 'ጉርሻ ብር'), t('Status', 'ሁኔታ'), ''].map((h, i) => <th key={i} className="th">{h}</th>)}
        </tr></thead>
          <tbody>{calcRows.map((c: any) => (<tr key={c.id}>
            <td className="td font-medium">{c.farmer_label}</td><td className="td">{fmt(c.delivered_kg)}</td>
            <td className="td">{c.avg_quality_score ? fmt(c.avg_quality_score) : '—'}</td><td className="td">{fmt(c.tier_rate_per_kg)}</td>
            <td className="td">{fmt(c.quality_multiplier)}</td><td className="td font-semibold">{fmt(c.gross_bonus_etb)}</td>
            <td className="td"><Badge value={c.status} /></td>
            <td className="td"><span className="flex gap-1">
              {(c.status === 'pending_approval' || c.status === 'calculated') && <>
                <button className="btn !px-2 !py-1 text-xs" onClick={() => act.mutate({ id: c.id, action: 'approve' })}><Check size={13} /> {t('Approve', 'አጽድቅ')}</button>
                <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => act.mutate({ id: c.id, action: 'reject', body: { reason: 'Rejected in bonus review' } })}><X size={13} /> {t('Reject', 'ውድቅ አድርግ')}</button></>}
              {c.status === 'approved' && <button className="btn !px-2 !py-1 text-xs" onClick={() => act.mutate({ id: c.id, action: 'pay', body: { method: 'bank' } })}><Coins size={13} /> {t('Pay', 'ክፈል')}</button>}
            </span></td></tr>))}
          </tbody></table>
        {!calcRows.length && <p className="text-sm py-3" style={{ color: 'var(--muted)' }}>{t('No calculations yet — run the calculation for this scheme.', 'እስካሁን ስሌት የለም — ለዚህ እቅድ ስሌት ያካሂዱ።')}</p>}
      </div>
    </Section>
    {view === 'all' && settingsBlock}
  </div>)
}

/* ============================ New procurement ============================ */
export function NewProcurement() {
  const t = useT(); const toast = useToast(); const qc = useQueryClient()
  const farmers = useList('/farmers/'); const centers = useList('/collection-centers/')
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState<any>({ intake_number: `INT-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`, farmer: '', center: '', station: '', intake_date: today, coffee_variety: 'Heirloom Kurume', site_altitude_m: 1950, gross_kg: 0, tare_kg: 0, floater_deduction_pct: 3, unit_price: 85, weight_source: 'manual', make_voucher: true })
  const net = Math.max(0, (Number(f.gross_kg) || 0) - (Number(f.tare_kg) || 0))
  const payable = net * (1 - (Number(f.floater_deduction_pct) || 0) / 100)
  const total = payable * (Number(f.unit_price) || 0)
  const create = useMutation({
    mutationFn: async () => {
      const intake = await post('/cherry-intakes/', { ...f, qr_receipt_code: `QR-${f.intake_number}` })
      let voucher: any = null
      if (f.make_voucher) {
        voucher = await post('/purchase-vouchers/', {
          voucher_number: `PV-${f.intake_number.replace('INT-', '')}`, station: f.station, farmer: f.farmer,
          intake: intake.id, voucher_date: f.intake_date, quantity_kg: payable.toFixed(2),
          unit_price: f.unit_price, total_amount: total.toFixed(2), status: 'pending',
        })
      }
      return { intake, voucher }
    },
    onSuccess: (d: any) => { toast(`${t('Procurement saved', 'ግዥ ተቀምጧል')} — ${fmt(d.intake.payable_kg)} ${t('kg', 'ኪ.ግ')} · ${fmt(d.intake.total_amount)} ETB${d.voucher ? ` · ${t('voucher', 'ወረቀት')} ${d.voucher.voucher_number}` : ''}`); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  return (
    <Section title={t('New Procurement — Cherry Purchase', 'አዲስ ግዥ — የቼሪ ግዥ')} sub={t('Record a complete cherry purchase from a farmer. Net, payable kg and total are computed live; optionally raise the purchase voucher in the same step.', 'ከገበሬ ሙሉ የቼሪ ግዥ ይመዝግቡ። የተጣራ፣ የሚከፈል ኪ.ግ እና ጠቅላላ በቀጥታ ይሰላሉ፤ ከፈለጉ የግዥ ወረቀቱንም በተመሳሳይ እርምጃ ያውጡ።')}>
      <div className="grid md:grid-cols-4 gap-2">
        <Field label={t('Intake number', 'የመቀበያ ቁጥር')}><input className="inp" value={f.intake_number} onChange={(e) => setF({ ...f, intake_number: e.target.value })} /></Field>
        <Field label={t('Farmer', 'ገበሬ')}><select className="inp" value={f.farmer} onChange={(e) => setF({ ...f, farmer: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{farmers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.farmer_code} — {x.full_name}</option>)}</select></Field>
        <Field label={t('Collection center', 'የመሰብሰቢያ ማዕከል')}><select className="inp" value={f.center} onChange={(e) => setF({ ...f, center: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{centers.rows.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label={t('Station', 'ጣቢያ')}><StationSelect value={f.station} onChange={(v: string) => setF({ ...f, station: v })} /></Field>
        <Field label={t('Date', 'ቀን')}><input className="inp" type="date" value={f.intake_date} onChange={(e) => setF({ ...f, intake_date: e.target.value })} /></Field>
        <Field label={t('Coffee variety', 'የቡና ዝርያ')}><input className="inp" value={f.coffee_variety} onChange={(e) => setF({ ...f, coffee_variety: e.target.value })} /></Field>
        <Field label={t('Site altitude (m)', 'የቦታ ቁመት (ሜ)')}><input className="inp" type="number" value={f.site_altitude_m} onChange={(e) => setF({ ...f, site_altitude_m: e.target.value })} /></Field>
        <Field label={t('Weight source', 'የሚዛን ምንጭ')}><select className="inp" value={f.weight_source} onChange={(e) => setF({ ...f, weight_source: e.target.value })}><option value="manual">{t('Manual entry', 'በእጅ ማስገቢያ')}</option><option value="scale_serial">{t('Digital scale', 'ዲጂታል ሚዛን')}</option></select></Field>
        <Field label={t('Gross weight (kg)', 'ጠቅላላ ክብደት (ኪ.ግ)')}><input className="inp" type="number" value={f.gross_kg} onChange={(e) => setF({ ...f, gross_kg: e.target.value })} /></Field>
        <Field label={t('Tare (kg)', 'ባዶ ክብደት (ኪ.ግ)')}><input className="inp" type="number" value={f.tare_kg} onChange={(e) => setF({ ...f, tare_kg: e.target.value })} /></Field>
        <Field label={t('Floater deduction %', 'የቅናሽ %')}><input className="inp" type="number" value={f.floater_deduction_pct} onChange={(e) => setF({ ...f, floater_deduction_pct: e.target.value })} /></Field>
        <Field label={t('Unit price (ETB/kg)', 'የአንዱ ዋጋ (ብር/ኪ.ግ)')}><input className="inp" type="number" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
        <span>{t('Net', 'የተጣራ')}: <b>{net.toFixed(2)} {t('kg', 'ኪ.ግ')}</b></span>
        <span>{t('Payable', 'የሚከፈል')}: <b>{payable.toFixed(2)} {t('kg', 'ኪ.ግ')}</b></span>
        <span>{t('Total', 'ጠቅላላ')}: <b>{total.toFixed(2)} ETB</b></span>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={f.make_voucher} onChange={(e) => setF({ ...f, make_voucher: e.target.checked })} /> {t('Raise purchase voucher (pending approval)', 'የግዥ ወረቀት አውጣ (ማጽደቅ በመጠበቅ ላይ)')}</label>
        <button className="btn" onClick={() => create.mutate()} disabled={!f.farmer || !f.center || !f.station || !(Number(f.gross_kg) > 0)}><Calculator size={15} /> {t('Save procurement', 'ግዥ አስቀምጥ')}</button>
      </div>
    </Section>)
}
