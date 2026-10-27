import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, ChevronDown, ChevronRight, Coffee, Eye, EyeOff, Lock, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen,
  Search, Sun, Wifi, WifiOff, X,
} from 'lucide-react'
import muragoSign from './assets/murago-sign.jpg'
import muragoLogo from './assets/murago-logo.png'
import { api, post } from './api'
import { NAV, LEAF_BY_ID, canSee, canList, type Leaf } from './nav'
import { ToastCtx, PageHeader, errMsg, toastEl, useList } from './ui'
import { useAuth, useStationCtx } from './store'
import { useTheme } from './theme'
import { LangSwitch, useLang, useT } from './i18n'

/* ---------------- lazy page loading (route-level code splitting) ---------------- */
const LOADERS: Record<Leaf['file'], () => Promise<any>> = {
  core: () => import('./pages-core'),
  quality: () => import('./pages-quality'),
  ops: () => import('./pages-ops'),
  admin: () => import('./pages-admin'),
  farm: () => import('./pages-farm'),
  site: () => import('./pages-site'),
  monitor: () => import('./pages-monitor'),
  hr: () => import('./pages-hr'),
}
const pageCache = new Map<string, React.LazyExoticComponent<any>>()
function pageComponent(leaf: Leaf): React.LazyExoticComponent<any> {
  if (!pageCache.has(leaf.id)) {
    pageCache.set(leaf.id, lazy(async () => {
      const m = await LOADERS[leaf.file]()
      const C = m[leaf.export]
      return { default: (props: any) => <C {...props} view={leaf.view} /> }
    }))
  }
  return pageCache.get(leaf.id)!
}

/* ---------------- login ---------------- */
function Login() {
  const { login } = useAuth(); const { theme, toggle } = useTheme(); const t = useT()
  const [u, setU] = useState('admin'); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await login(u, p) } catch (x: any) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  const stats: [string, string][] = [
    [t('Washing stations', 'የማጠቢያ ጣቢያዎች'), 'MUR · BEN'],
    [t('Altitude', 'ቁመት'), '1,950 m'],
    [t('Process', 'ዘዴ'), t('Washed · Natural', 'የታጠበ · ተፈጥሮ')],
  ]
  return (<div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg)' }}>
    {/* ——— Brand panel: the Murago road sign photo ——— */}
    <div className="relative lg:w-[54%] h-64 sm:h-72 lg:h-auto shrink-0 overflow-hidden">
      <img src={muragoSign} alt={t('The Murago road sign, Sidama', 'የሙራጎ የመንገድ ምልክት፣ ሲዳማ')} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 38%' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(12,8,4,0.18) 0%, rgba(12,8,4,0.05) 38%, rgba(12,8,4,0.78) 100%)' }} />
      <div className="absolute top-4 left-4">
        <span className="inline-flex items-center rounded-2xl px-3 py-2 shadow-lg" style={{ background: 'rgba(255,255,255,0.96)' }}>
          <img src={muragoLogo} alt="Murago Coffee" className="h-14 sm:h-[76px] w-auto" />
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 hidden sm:block">
        <p className="text-white font-semibold text-xl sm:text-2xl leading-snug max-w-md" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
          {t('From Sidama’s highlands to the world — every cherry, every lot, one system.', 'ከሲዳማ ቡና ምድር ወደ ዓለም — እያንዳንዱ ቼሪ፣ እያንዳንዱ ሎት፣ በአንድ ሲስተም።')}
        </p>
        <p className="text-white/80 text-xs sm:text-sm mt-2" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
          {t('Murago Washing Station · Aleta Wondo · Sidama, Ethiopia', 'የሙራጎ ማጠቢያ ጣቢያ · አሌታ ወንዶ · ሲዳማ፣ ኢትዮጵያ')}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {stats.map(([l, v]) => (
            <span key={l} className="rounded-full px-3 py-1.5 text-[11px] sm:text-xs text-white" style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.28)' }}>
              {l}: <b>{v}</b></span>))}
        </div>
      </div>
    </div>

    {/* ——— Sign-in panel ——— */}
    <div className="flex-1 flex flex-col relative">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10"><LangSwitch /><button className="btn-ghost !px-2.5" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div>
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <span className="inline-flex items-center rounded-xl px-2.5 py-1.5 mb-4 lg:hidden shadow-sm" style={{ background: '#fff', border: '1px solid var(--border)' }}><img src={muragoLogo} alt="Murago Coffee" className="h-11 w-auto" /></span>
          <h1 className="text-2xl sm:text-[28px] font-bold leading-tight" style={{ color: 'var(--text)' }}>{t('Welcome back', 'እንኳን ደህና መጣህ')}</h1>
          <p className="text-sm mt-1.5 mb-6" style={{ color: 'var(--muted)' }}>
            {t('Sign in to Murago Coffee ERP — the Bean Power operations platform. Access is role-based and station-scoped.', 'ወደ ሙራጎ የቡና ERP ይግቡ — የBean Power የሥራ መድረክ። መዳረሻ የሚና-ተኮር እና በጣቢያ የተወሰነ ነው።')}
          </p>
          {err && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{err}</div>}
          <label className="block"><span className="lbl">{t('Username', 'የተጠቃሚ ስም')}</span>
            <input className="inp !py-2.5" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" placeholder="admin" /></label>
          <label className="block mt-3"><span className="lbl">{t('Password', 'የይለፍ ቃል')}</span>
            <span className="relative block">
              <input className="inp !py-2.5 !pr-10" type={showPw ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1" style={{ color: 'var(--muted)' }}
                onClick={() => setShowPw(!showPw)} aria-label={showPw ? t('Hide password', 'የይለፍ ቃል ደብቅ') : t('Show password', 'የይለፍ ቃል አሳይ')}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </span></label>
          <button className="btn w-full justify-center mt-6 !py-3 text-[15px] font-semibold" disabled={busy}>{busy ? t('Signing in…', 'በመግባት ላይ…') : t('Sign in', 'ግባ')}</button>
          <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>{t('Demo credentials are documented in the production readiness report (demo only — rotate before real use).', 'የሙከራ መለያዎች በዝግጁነት ሪፖርቱ ውስጥ ተመዝግበዋል (ለሙከራ ብቻ — ለእውነተኛ አገልግሎት ይቀይሩ)።')}</p>
        </form>
      </div>
      <p className="text-center text-[11px] pb-5 px-4" style={{ color: 'var(--muted)' }}>
        Murago Coffee Processing PLC · {t('Enterprise system by', 'የኢንተርፕራይዝ ሲስተም በ')} Orbit Technology Solution PLC
      </p>
    </div>
  </div>)
}

/* ---------------- notifications bell (Module 24) ---------------- */
function NotificationsBell({ go }: { go: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const unread = useQuery({ queryKey: ['notif-unread'], queryFn: () => api('/api/notifications/unread-count/'), refetchInterval: 30000 })
  const items = useList('/notifications/')
  const mark = useMutation({ mutationFn: (id: string) => post(`/notifications/${id}/mark-read/`, {}), onSuccess: () => qc.invalidateQueries() })
  const markAll = useMutation({ mutationFn: () => post('/notifications/mark-all-read/', {}), onSuccess: () => qc.invalidateQueries() })
  const count = unread.data?.unread ?? 0
  const sevColor = (s: string) => s === 'critical' ? 'var(--danger)' : s === 'warning' ? 'var(--warning)' : 'var(--info)'
  return (<div className="relative">
    <button className="btn-ghost !px-2.5 relative" onClick={() => setOpen(!open)} aria-label={`Notifications, ${count} unread`}>
      <Bell size={17} />
      {count > 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: 'var(--danger)', color: '#fff' }}>{count}</span>}
    </button>
    {open && (<div className="absolute right-0 mt-2 w-84 max-w-[92vw] max-h-96 overflow-auto rounded-xl z-50 text-left card !p-0" style={{ boxShadow: 'var(--shadow-lg)', width: '21rem' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <b className="text-sm" style={{ color: 'var(--text)' }}>{'Notifications'}</b>
        <span className="flex gap-3">
          <button className="text-xs" style={{ color: 'var(--accent)' }} onClick={() => markAll.mutate()}>Mark all read</button>
          <button className="text-xs" style={{ color: 'var(--accent)' }} onClick={() => { go('notifications'); setOpen(false) }}>View all</button>
        </span>
      </div>
      {items.rows.length ? items.rows.slice(0, 20).map((n: any) => (
        <button key={n.id} className="block w-full text-left px-3 py-2" style={{ borderBottom: '1px solid var(--border)', opacity: n.is_read ? 0.6 : 1 }}
          onClick={() => { mark.mutate(n.id); setOpen(false) }}>
          <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sevColor(n.severity) }} />{n.title}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{n.body}</div>
          <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{n.category} · {String(n.created_at).slice(0, 16).replace('T', ' ')}</div>
        </button>)) : <p className="text-sm px-3 py-3" style={{ color: 'var(--muted)' }}>No notifications.</p>}
    </div>)}
  </div>)
}

/* ---------------- sidebar ---------------- */
function Sidebar({ page, go, roles, collapsed, mobileOpen, closeMobile }: any) {
  const { lang } = useLang()
  const gl = (g: any) => (lang === 'am' ? (g.labelAm ?? g.label) : g.label)
  const ll = (l: any) => (lang === 'am' ? (l.labelAm ?? l.label) : l.label)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    let stored: Record<string, boolean> = {}
    try { stored = JSON.parse(localStorage.getItem('murago_nav_groups') || '{}') } catch { stored = {} }
    // One-time migration (murago-v9 / HR nav fix): a stored collapsed HR group
    // is stale from before the HR build — open HR once, then respect toggles.
    try {
      if (localStorage.getItem('murago_nav_hr_migrated') !== '1') {
        stored = { ...stored, hr: true }
        localStorage.setItem('murago_nav_groups', JSON.stringify(stored))
        localStorage.setItem('murago_nav_hr_migrated', '1')
      }
    } catch { /* ignore */ }
    return stored
  })
  const toggleGroup = (id: string) => {
    setExpanded((prev: Record<string, boolean>) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) }
      try { localStorage.setItem('murago_nav_groups', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  // HR leaves are always listed (canList); other groups keep role filtering.
  const visible = NAV.map((g) => ({ ...g, leaves: g.leaves.filter((l) => canList(l, roles, g.id)) })).filter((g) => g.leaves.length)
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}>
      <div className="flex items-center gap-2.5 px-3.5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0 overflow-hidden" style={{ background: '#fff' }}><img src={muragoLogo} alt="Murago Coffee" className="h-[34px] w-auto" /></span>
        {!collapsed && <div className="min-w-0"><div className="font-bold leading-tight" style={{ color: '#fff' }}>Murago Coffee ERP</div>
          <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>{lang === 'am' ? 'Bean Power ERP · ከእርሻ → ኤክስፖርት' : 'Bean Power ERP · farm → export'}</div></div>}
      </div>
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-2 py-2" aria-label="Main navigation">
        {visible.map((g) => {
          const GIcon = g.icon
          const isOpen = expanded[g.id] ?? true
          const groupActive = g.leaves.some((l) => l.id === page)
          if (collapsed) {
            return (<div key={g.id} className="mb-1">
              {g.leaves.map((l) => { const Icon = l.icon; const locked = !canSee(l, roles); return (
                <button key={l.id} title={`${gl(g)} — ${ll(l)}${locked ? ' (restricted — requires an HR role)' : ''}`} aria-label={ll(l)} onClick={() => { go(l.id); closeMobile() }}
                  className="relative w-full flex items-center justify-center min-h-[44px] rounded-lg mb-0.5"
                  style={page === l.id ? { background: 'var(--btn-bg)', color: 'var(--btn-text)' } : locked ? { color: 'var(--sidebar-muted)', opacity: 0.75 } : { color: 'var(--sidebar-text)' }}>
                  <Icon size={18} />
                  {locked && <Lock size={10} className="absolute bottom-1 right-2" aria-hidden />}
                </button>) })}
            </div>)
          }
          return (<div key={g.id} className="mb-1.5">
            <button className="w-full flex items-center gap-2 px-2.5 min-h-[36px] rounded-lg text-[11px] font-bold uppercase tracking-wider"
              style={{ color: groupActive ? 'var(--accent-strong)' : 'var(--sidebar-muted)' }}
              onClick={() => toggleGroup(g.id)} aria-expanded={isOpen}>
              <GIcon size={15} /><span className="flex-1 text-left">{gl(g)}</span>
              {g.id === 'hr' && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--btn-bg)', color: 'var(--btn-text)' }}>{g.leaves.length}</span>}
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isOpen && g.leaves.map((l) => { const Icon = l.icon; const locked = !canSee(l, roles); return (
              <button key={l.id} onClick={() => { go(l.id); closeMobile() }}
                className="w-full flex items-center gap-2.5 pl-4 pr-2.5 min-h-[40px] rounded-lg text-sm text-left"
                style={page === l.id ? { background: 'var(--btn-bg)', color: 'var(--btn-text)', fontWeight: 600 } : locked ? { color: 'var(--sidebar-muted)', opacity: 0.8 } : { color: 'var(--sidebar-text)' }}>
                <Icon size={16} className="shrink-0" /><span className="truncate flex-1">{ll(l)}</span>
                {locked && <Lock size={13} className="shrink-0" aria-label="Restricted" />}
              </button>) })}
          </div>)
        })}
      </nav>
      {!collapsed && <div className="px-3.5 py-3 text-[11px]" style={{ borderTop: '1px solid var(--sidebar-border)', color: 'var(--sidebar-muted)' }}>
        {lang === 'am' ? '25+ ሞዱሎች · የሚና ፈቃድ በAPI ይተገበራል' : '25 modules · role-based access enforced by the API'}
      </div>}
    </div>
  )
}

/* ---------------- topbar ---------------- */
function Topbar({ page, go, roles }: any) {
  const { user, logout } = useAuth(); const { lang } = useLang(); const t = useT()
  const ll = (l: any) => (lang === 'am' ? (l.labelAm ?? l.label) : l.label)
  const gl2 = (g: any) => (lang === 'am' ? (g.labelAm ?? g.label) : g.label)
  const { theme, toggle } = useTheme()
  const stations = useList('/stations/')
  const { stationId, setStationId } = useStationCtx()
  const [q, setQ] = useState(''); const [searchFocus, setSearchFocus] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const results = useMemo(() => {
    if (!q.trim()) return []
    const needle = q.trim().toLowerCase()
    return NAV.flatMap((g) => g.leaves.filter((l) => canList(l, roles, g.id)).map((l) => ({ leaf: l, group: g })))
      .filter(({ leaf, group }) => leaf.label.toLowerCase().includes(needle) || (leaf.labelAm ?? '').includes(q.trim()) || group.label.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [q, roles])
  const leaf = LEAF_BY_ID[page]
  return (<header className="sticky top-0 z-30 flex items-center gap-2 px-3 md:px-5 py-2.5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
    <nav className="hidden lg:flex items-center gap-1.5 text-sm flex-1 min-w-0" aria-label="Breadcrumb">
      <span style={{ color: 'var(--muted)' }}>{leaf ? gl2(leaf.group) : ''}</span>
      <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
      <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{leaf ? ll(leaf) : ''}</span>
    </nav>
    <div className="relative flex-1 lg:flex-none lg:w-72">
      <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
      <input className="inp !pl-8" placeholder={t('Search pages…', 'ገጾችን ፈልግ…')} value={q} aria-label="Search pages"
        onChange={(e) => setQ(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 150)} />
      {searchFocus && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 card !p-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {results.map(({ leaf: l, group }) => (
            <button key={l.id} className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}
              onClick={() => { go(l.id); setQ('') }}>
              <l.icon size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text)' }}>{ll(l)}</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>{gl2(group)}</span>
            </button>))}
        </div>)}
    </div>
    <select className="inp !w-auto hidden md:block" value={stationId} onChange={(e) => setStationId(e.target.value)} aria-label="Station context" title="Station context — defaults station pickers across forms">
      <option value="">{t('All stations', 'ሁሉም ጣቢያዎች')}</option>
      {stations.rows.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
    </select>
    <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: online ? 'var(--success)' : 'var(--danger)' }}>
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? t('Online', 'በመስመር ላይ') : t('Offline', 'ከመስመር ውጭ')}
    </span>
    <LangSwitch />
    <NotificationsBell go={go} />
    <button className="btn-ghost !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
    <div className="relative">
      <button className="btn-ghost !px-2.5" onClick={() => setUserMenu(!userMenu)} aria-label="User menu">
        <span className="font-semibold text-sm">{user?.username}</span><ChevronDown size={14} />
      </button>
      {userMenu && (<div className="absolute right-0 mt-2 w-56 rounded-xl z-50 card !p-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{user?.username}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Roles: {(user?.role_codes ?? []).join(', ') || '—'}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Stations: {user?.station_ids ? `${user.station_ids.length} assigned` : 'all stations'}</div>
        </div>
        <button className="w-full text-left px-3 py-2.5 text-sm inline-flex items-center gap-2" style={{ color: 'var(--danger)' }}
          onClick={() => { setUserMenu(false); logout() }}><LogOut size={15} /> {t('Sign out', 'ውጣ')}</button>
      </div>)}
    </div>
  </header>)
}

/* ---------------- shell ---------------- */
export default function App() {
  const { user, ready, restore } = useAuth(); const { lang } = useLang(); const t = useT()
  const [page, setPage] = useState(() => (location.hash || '#dashboard').slice(1))
  const [toastState, setToastState] = useState<{ msg: string; ok: boolean } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('murago_nav_collapsed') === '1' } catch { return false } })
  const toastTimer = useRef<any>(null)
  useEffect(() => { restore() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onHash = () => setPage((location.hash || '#dashboard').slice(1))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const toast = (msg: string, ok = true) => {
    setToastState({ msg, ok })
    clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastState(null), 6000)
  }
  const go = (id: string) => { if (location.hash !== `#${id}`) location.hash = id; setPage(id) }
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('murago_nav_collapsed', c ? '0' : '1') } catch { /* ignore */ } return !c })

  if (!ready) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--muted)' }}>{t('Loading Murago ERP…', 'Murago ERP በመጫን ላይ…')}</div>
  if (!user) return <ToastCtx.Provider value={toast}><Login />{toastEl(toastState)}</ToastCtx.Provider>

  const roles: string[] = user.role_codes ?? []
  const requestedLeaf = LEAF_BY_ID[page]
  const accessDenied = !!requestedLeaf && !canSee(requestedLeaf, roles)
  // Keep the requested leaf for header/breadcrumb/highlight even when denied —
  // the denied view below renders instead of silently falling back to Dashboard.
  const leaf = requestedLeaf ?? LEAF_BY_ID['dashboard']
  const Active = pageComponent(leaf)
  return (<ToastCtx.Provider value={toast}>
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* desktop sidebar */}
      <aside className={`hidden md:block shrink-0 sticky top-0 h-screen transition-all ${collapsed ? 'w-[68px]' : 'w-64'}`}>
        <Sidebar page={leaf.id} go={go} roles={roles} collapsed={collapsed} mobileOpen={false} closeMobile={() => {}} />
      </aside>
      {/* mobile drawer */}
      {mobileOpen && <div className="md:hidden fixed inset-0 z-50 flex">
        <div className="w-72 max-w-[85vw] h-full shadow-2xl"><Sidebar page={leaf.id} go={go} roles={roles} collapsed={false} mobileOpen closeMobile={() => setMobileOpen(false)} /></div>
        <button className="flex-1" style={{ background: 'rgb(0 0 0 / 0.45)' }} aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      </div>}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-stretch">
          <button className="md:hidden btn-ghost !border-0 !rounded-none" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <button className="hidden md:inline-flex btn-ghost !border-0 !rounded-none items-center" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="flex-1 min-w-0"><Topbar page={leaf.id} go={go} roles={roles} /></div>
        </div>
        <main className="flex-1 min-w-0 p-3 md:p-5 max-w-[1600px] w-full mx-auto">
          <PageHeader title={lang === 'am' ? (leaf.labelAm ?? leaf.label) : leaf.label} subtitle={lang === 'am' ? (leaf.subtitleAm ?? leaf.subtitle) : leaf.subtitle} />
          <Suspense fallback={<div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 w-full" />)}</div>}>
            {accessDenied ? (
              <div className="card p-6 sm:p-8 max-w-xl mx-auto mt-8 text-center">
                <div className="text-4xl mb-3" aria-hidden>🔒</div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{t('Access restricted', 'መዳረሻ የተገደበ')}</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                  {t(`Your account does not have one of the required roles for “${requestedLeaf.label}”: ${(requestedLeaf.roles ?? []).join(', ') || 'all authenticated users'}. The HR submodules are listed for everyone, but their data is role-protected — if you need access, ask your system administrator to assign one of those roles.`,
                     `መለያዎ ለ“${requestedLeaf.labelAm ?? requestedLeaf.label}” ከሚያስፈልጉ ሚናዎች አንዱን የለውም፦ ${(requestedLeaf.roles ?? []).join(', ') || 'ሁሉም የተረጋገጡ ተጠቃሚዎች'}። የሰው ሀብት ንዑስ ሞዱሎች ለሁሉም ይታያሉ፣ ነገር ግን መረጃቸው በሚና የተጠበቀ ነው — መዳረሻ ከፈልጉ የሲስተም አስተዳዳሪዎን ከእነዚህ ሚናዎች አንዱን እንዲሰጥዎት ይጠይቁ።`)}
                </p>
                <button className="btn mt-4" onClick={() => go('dashboard')}>{t('Go to Dashboard', 'ወደ ዳሽቦርድ ሂድ')}</button>
              </div>
            ) : <Active key={leaf.id} />}
          </Suspense>
        </main>
        <footer className="px-5 py-3 text-[11px] flex flex-wrap gap-2 items-center" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
          <span>Murago Coffee ERP · Bean Power ERP</span><span aria-hidden>·</span>
          <span>{t('Signed in as', 'ገብቷል እንደ')} <b>{user.username}</b> ({roles.join(', ') || t('no roles', 'ሚና የለም')})</span>
          {mobileOpen && <button onClick={() => setMobileOpen(false)}><X size={12} /></button>}
        </footer>
      </div>
    </div>
    {toastEl(toastState)}
  </ToastCtx.Provider>)
}
