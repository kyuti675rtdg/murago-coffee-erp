import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, ChevronUp, Inbox, RotateCcw, Search } from 'lucide-react'
import { api, list } from './api'
import { tr, useLang, useT } from './i18n'
import { useStationCtx } from './store'

/* ---------------- toast ---------------- */
export const ToastCtx = createContext<(msg: string, ok?: boolean) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function toastEl(t: { msg: string; ok: boolean } | null) {
  return t ? <div className={`toast ${t.ok ? '' : ''}`} style={{ background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff' }}>{t.msg}</div> : null
}

/* ---------------- data helpers (real APIs only — no demo fallback) ---------------- */
export function useList(path: string) {
  const q = useQuery({ queryKey: ['list', path], queryFn: () => list(path) })
  return { ...q, rows: (q.data ?? []) as any[] }
}
export function errMsg(e: any): string { return e?.body?.detail || e?.message || 'Request failed' }

/* ---------------- badges ---------------- */
const TONES: Record<string, string> = {
  ok: 'badge-success', success: 'badge-success', approved: 'badge-success', verified: 'badge-success', active: 'badge-success',
  true: 'badge-success', present: 'badge-success', posted: 'badge-success', sealed: 'badge-success', completed: 'badge-success',
  ready: 'badge-success', paid: 'badge-success', reconciled: 'badge-success',
  critical: 'badge-danger', rejected: 'badge-danger', failed: 'badge-danger', false: 'badge-danger', absent: 'badge-danger',
  warning: 'badge-warning', pending: 'badge-warning', draft: 'badge-warning', prepared: 'badge-warning', loading: 'badge-warning',
  open: 'badge-info', info: 'badge-info', in_transit: 'badge-info',
}
export function Badge({ value }: { value: any }) {
  const s = String(value ?? '—')
  return <span className={`badge ${TONES[s.toLowerCase()] ?? ''}`}>{s.replace(/_/g, ' ')}</span>
}
const BADGE_KEYS = new Set(['status', 'result', 'decision', 'severity', 'kyc_status', 'is_read', 'is_active', 'is_anomaly', 'moisture_warning', 'certified_separation_ok', 'deforestation_free', 'is_locked', 'recipient_signed', 'is_reconciled'])

/* ---------------- standard data table ----------------
   Search + client sort (click header) + pagination + loading skeleton +
   honest empty state + error state with retry. `state` = a useList result. */
export function T({ rows, cols, state, pageSize = 15, searchPlaceholder, onRowClick, renderCell }: {
  rows: any[]; cols: [string, string][]; state?: any; pageSize?: number; searchPlaceholder?: string
  onRowClick?: (row: any) => void
  renderCell?: (row: any, key: string) => React.ReactNode | undefined
}) {
  const t = useT()
  const { lang } = useLang()
  const ph = searchPlaceholder ?? t('Search…', 'ፈልግ…')
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    let out = rows
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      out = out.filter((r) => cols.some(([k]) => String(r[k] ?? '').toLowerCase().includes(needle)))
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey]
        const an = Number(av); const bn = Number(bv)
        const cmp = (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''))
        return cmp * sortDir
      })
    }
    return out
  }, [rows, q, sortKey, sortDir, cols])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize)
  useEffect(() => { setPage(0) }, [q, rows.length])

  if (state?.isLoading) {
    return <div aria-busy="true" className="space-y-2 py-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
  }
  if (state?.isError) {
    return (<div className="flex flex-col items-start gap-2 py-4 text-sm" style={{ color: 'var(--danger)' }}>
      <span className="inline-flex items-center gap-2"><AlertTriangle size={16} /> {t('Could not load records', 'መዝገቦችን መጫን አልተቻለም')}: {errMsg(state.error)}</span>
      <button className="btn-ghost !py-1 text-xs" onClick={() => state.refetch?.()}><RotateCcw size={13} /> {t('Retry', 'እንደገና ሞክር')}</button>
    </div>)
  }
  return (<div>
    <div className="relative max-w-xs mb-2">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
      <input className="inp !pl-8 !py-1.5 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ph} aria-label="Search table" />
    </div>
    {!pageRows.length ? (
      <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--muted)' }}><Inbox size={16} /> {q ? `${t('No records match', 'ምንም መዝገብ አልተገኘም ለ')} “${q}”.` : t('No records yet.', 'እስካሁን ምንም መዝገብ የለም።')}</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>{cols.map(([k, l]) => (
            <th key={k} className="th"><button className="inline-flex items-center gap-1 uppercase" onClick={() => { if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(k); setSortDir(1) } }} aria-label={`Sort by ${l}`}>
              {tr(lang, l)}{sortKey === k ? (sortDir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}</button></th>
          ))}</tr></thead>
          <tbody>{pageRows.map((r, i) => <tr key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={onRowClick ? 'cursor-pointer hover:opacity-80' : undefined} title={onRowClick ? t('Open profile', 'መገለጫ ክፈት') : undefined}>{cols.map(([k]) => (
            <td key={k} className="td">{(() => { const custom = renderCell?.(r, k); return custom !== undefined ? custom : (BADGE_KEYS.has(k) || k.endsWith('_status') ? <Badge value={r[k]} /> : String(r[k] ?? '—')) })()}</td>
          ))}</tr>)}</tbody>
        </table>
      </div>
    )}
    {filtered.length > pageSize && (
      <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
        <button className="btn-ghost !py-1 !px-2 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('Prev', 'ቀዳሚ')}</button>
        <span>{t('Page', 'ገጽ')} {page + 1} {t('of', 'ከ')} {pages} · {filtered.length} {t('records', 'መዝገቦች')}</span>
        <button className="btn-ghost !py-1 !px-2 text-xs" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t('Next', 'ቀጣይ')}</button>
      </div>
    )}
  </div>)
}

/* ---------------- layout primitives ---------------- */
export function Section({ title, sub, children, action }: any) {
  const { lang } = useLang()
  const tt = typeof title === 'string' ? tr(lang, title) : title
  const ss = typeof sub === 'string' ? tr(lang, sub) : sub
  return (<section className="card mb-4">
    <div className="flex flex-wrap items-start gap-2">
      <div className="flex-1 min-w-[200px]"><h3 className="font-bold" style={{ color: 'var(--text)' }}>{tt}</h3>
        {ss && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{ss}</p>}</div>
      {action}
    </div>
    <div className="mt-2">{children}</div>
  </section>)
}
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (<div className="flex flex-wrap items-end gap-2 mb-4">
    <div className="flex-1 min-w-[220px]"><h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
      {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>}</div>
    {action}
  </div>)
}
export function Field({ label, children }: any) {
  const { lang } = useLang()
  return <label className="block"><span className="lbl">{typeof label === 'string' ? tr(lang, label) : label}</span>{children}</label>
}
export function FormError({ msg }: { msg: string }) {
  return msg ? <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{msg}</p> : null
}

/* ---------------- shared selects ---------------- */
export function useStations() { return useList('/stations/') }
export function StationSelect({ value, onChange }: any) {
  const { rows } = useStations()
  const t = useT()
  const ctxStation = useStationCtx((s) => s.stationId)
  useEffect(() => { if (!value && ctxStation) onChange(ctxStation) }, [ctxStation]) // eslint-disable-line react-hooks/exhaustive-deps
  return <select className="inp" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Station"><option value="">{t('Select station…', 'ጣቢያ ምረጥ…')}</option>{rows.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
}
export function useUsers() { return useQuery({ queryKey: ['users'], queryFn: () => api('/api/users/') }) }
export function UserSelect({ value, onChange }: any) {
  const { data } = useUsers()
  const t = useT()
  return <select className="inp" value={value} onChange={(e) => onChange(e.target.value)} aria-label="User"><option value="">{t('Select user…', 'ተጠቃሚ ምረጥ…')}</option>{(data ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.username}</option>)}</select>
}
