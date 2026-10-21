import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, ChevronDown, ChevronRight, Coffee, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen,
  Search, Sun, Wifi, WifiOff, X,
} from 'lucide-react'
import { api, post } from './api'
import { NAV, LEAF_BY_ID, canSee, type Leaf } from './nav'
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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await login(u, p) } catch (x: any) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  return (<div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
    <div className="absolute top-4 right-4 flex items-center gap-2"><LangSwitch /><button className="btn-ghost !px-2.5" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    <form onSubmit={submit} className="card w-full max-w-sm !p-6" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="flex items-center gap-3 mb-1">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl" style={{ background: 'var(--btn-bg)', color: 'var(--btn-text)' }}><Coffee size={22} /></span>
        <div><h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Murago Coffee ERP</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('Bean Power ERP — farm to export', 'Bean Power ERP — ከእርሻ እስከ ኤክስፖርት')}</p></div>
      </div>
      <p className="text-sm mt-3 mb-4" style={{ color: 'var(--muted)' }}>{t('Sign in with your station account. Access is role-based and station-scoped.', 'በጣቢያዎ መለያ ይግቡ። መዳረሻ በሚና እና በጣቢያ ወሰን ይወሰናል።')}</p>
      {err && <div className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{err}</div>}
      <label className="block"><span className="lbl">{t('Username', 'የተጠቃሚ ስም')}</span>
        <input className="inp" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></label>
      <label className="block mt-3"><span className="lbl">{t('Password', 'የይለፍ ቃል')}</span>
        <input className="inp" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
      <button className="btn w-full justify-center mt-5" disabled={busy}>{busy ? t('Signing in…', 'በመግባት ላይ…') : t('Sign in', 'ግባ')}</button>
      <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>{t('Demo credentials are documented in the production readiness report (demo only — rotate before real use).', 'የሙከራ መለያዎች በዝግጁነት ሪፖርቱ ውስጥ ተመዝግበዋል (ለሙከራ ብቻ — ለእውነተኛ አገልግሎት ይቀይሩ)።')}</p>
    </form>
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
    try { return JSON.parse(localStorage.getItem('murago_nav_groups') || '{}') } catch { return {} }
  })
  const toggleGroup = (id: string) => {
    setExpanded((prev: Record<string, boolean>) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) }
      try { localStorage.setItem('murago_nav_groups', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  const visible = NAV.map((g) => ({ ...g, leaves: g.leaves.filter((l) => canSee(l, roles)) })).filter((g) => g.leaves.length)
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}>
      <div className="flex items-center gap-2.5 px-3.5 py-4" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: 'var(--btn-bg)', color: 'var(--btn-text)' }}><Coffee size={19} /></span>
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
              {g.leaves.map((l) => { const Icon = l.icon; return (
                <button key={l.id} title={`${gl(g)} — ${ll(l)}`} aria-label={ll(l)} onClick={() => { go(l.id); closeMobile() }}
                  className="w-full flex items-center justify-center min-h-[44px] rounded-lg mb-0.5"
                  style={page === l.id ? { background: 'var(--btn-bg)', color: 'var(--btn-text)' } : { color: 'var(--sidebar-text)' }}>
                  <Icon size={18} /></button>) })}
            </div>)
          }
          return (<div key={g.id} className="mb-1.5">
            <button className="w-full flex items-center gap-2 px-2.5 min-h-[36px] rounded-lg text-[11px] font-bold uppercase tracking-wider"
              style={{ color: groupActive ? 'var(--accent-strong)' : 'var(--sidebar-muted)' }}
              onClick={() => toggleGroup(g.id)} aria-expanded={isOpen}>
              <GIcon size={15} /><span className="flex-1 text-left">{gl(g)}</span>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isOpen && g.leaves.map((l) => { const Icon = l.icon; return (
              <button key={l.id} onClick={() => { go(l.id); closeMobile() }}
                className="w-full flex items-center gap-2.5 pl-4 pr-2.5 min-h-[40px] rounded-lg text-sm text-left"
                style={page === l.id ? { background: 'var(--btn-bg)', color: 'var(--btn-text)', fontWeight: 600 } : { color: 'var(--sidebar-text)' }}>
                <Icon size={16} className="shrink-0" /><span className="truncate">{ll(l)}</span>
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
    return NAV.flatMap((g) => g.leaves.filter((l) => canSee(l, roles)).map((l) => ({ leaf: l, group: g })))
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
  const leaf = LEAF_BY_ID[page] && canSee(LEAF_BY_ID[page], roles) ? LEAF_BY_ID[page] : LEAF_BY_ID['dashboard']
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
            <Active key={leaf.id} />
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
