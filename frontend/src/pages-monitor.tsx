import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Info, Maximize2, Minimize2, RefreshCw, Video, X } from 'lucide-react'
import { api, post } from './api'
import { Field, Section, T, errMsg, useList, useToast } from './ui'
import { useT } from './i18n'

/* ---------------- simulated demo feed (canvas) ----------------
   A clearly-labelled DEMO view: animated scene + sweep + grain.
   It is NOT a real camera image — every tile carries a DEMO badge. */
function DemoFeed({ cam, label }: { cam: any; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let raf = 0; let last = 0
    const seed = (cam.sort_order ?? 1) * 1.7
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      if (ts - last < 80) return // ~12 fps is plenty for a demo feed
      last = ts
      const W = canvas.width, H = canvas.height
      const hueShift = Math.sin(ts / 9000 + seed) * 6
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#232d1e'); grad.addColorStop(0.55, '#2e3a26'); grad.addColorStop(1, '#141a10')
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      // distant tree line
      ctx.fillStyle = 'rgba(10,14,8,0.55)'
      for (let i = 0; i < 9; i++) {
        const x = ((i * 83 + seed * 37 + hueShift * 2) % (W + 60)) - 30
        const r = 22 + ((i * 13) % 17)
        ctx.beginPath(); ctx.arc(x, H * 0.52, r, 0, Math.PI * 2); ctx.fill()
      }
      // buildings / tanks silhouettes
      ctx.fillStyle = 'rgba(8,10,6,0.8)'
      ctx.fillRect(W * 0.08 + hueShift, H * 0.42, W * 0.2, H * 0.3)
      ctx.fillRect(W * 0.62 + hueShift, H * 0.38, W * 0.26, H * 0.34)
      ctx.fillStyle = 'rgba(8,10,6,0.65)'
      ctx.fillRect(W * 0.36 + hueShift, H * 0.5, W * 0.14, H * 0.22)
      // ground
      ctx.fillStyle = 'rgba(6,8,5,0.9)'; ctx.fillRect(0, H * 0.72, W, H * 0.28)
      ctx.fillStyle = 'rgba(217,119,6,0.20)'; ctx.fillRect(0, H * 0.72, W, 2)
      // slow light sweep
      const sweepX = ((ts / 14 + seed * 120) % (W * 1.6)) - W * 0.3
      const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 90, 0)
      sweep.addColorStop(0, 'rgba(255,255,255,0)'); sweep.addColorStop(0.5, 'rgba(255,255,255,0.05)'); sweep.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = sweep; ctx.fillRect(0, 0, W, H)
      // grain
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      for (let i = 0; i < 90; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4)
      // timestamp burn-in
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(8, H - 24, 196, 17)
      ctx.fillStyle = '#e7e5e4'; ctx.font = '11px monospace'
      ctx.fillText(new Date().toLocaleString('en-GB'), 12, H - 12)
      ctx.fillStyle = 'rgba(217,119,6,0.9)'; ctx.font = 'bold 10px monospace'
      ctx.fillText(label, W - 118, 16)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cam.id, cam.sort_order, label])
  return <canvas ref={ref} width={640} height={360} className="w-full h-full block" style={{ objectFit: 'cover' }} />
}

/* ---------------- real stream feed (HLS / MP4) ---------------- */
function RealFeed({ cam }: { cam: any }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const video = ref.current; if (!video || !cam.stream_url) return
    let hls: any = null; let cancelled = false
    const attach = async () => {
      try {
        if (cam.stream_type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
          const Hls = (await import('hls.js')).default
          if (cancelled) return
          if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 10 })
            hls.loadSource(cam.stream_url); hls.attachMedia(video)
            hls.on(Hls.Events.ERROR, (_e: any, data: any) => { if (data?.fatal) setFailed(true) })
          } else { video.src = cam.stream_url }
        } else {
          video.src = cam.stream_url
        }
        video.play().catch(() => { /* autoplay policies: muted+playsInline set */ })
      } catch { setFailed(true) }
    }
    attach()
    return () => { cancelled = true; try { hls?.destroy() } catch { /* ignore */ } }
  }, [cam.stream_url, cam.stream_type])
  if (!cam.stream_url) return <div className="w-full h-full flex items-center justify-center text-xs" style={{ background: '#111', color: '#a8a29e' }}>No stream URL configured</div>
  if (failed) return <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-xs" style={{ background: '#111', color: '#fca5a5' }}><Video size={20} /><span>Stream unavailable — check the NVR/gateway</span></div>
  return <video ref={ref} className="w-full h-full block" style={{ objectFit: 'cover', background: '#000' }} autoPlay muted playsInline loop={cam.stream_type === 'mp4'} />
}

/* ---------------- one camera tile ---------------- */
function CameraTile({ cam, stationName, big = false, onExpand }: { cam: any; stationName: string; big?: boolean; onExpand?: () => void }) {
  const t = useT(); const toast = useToast()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [epoch, setEpoch] = useState(0)
  const isDemo = cam.stream_type === 'demo'
  const statusChip = isDemo
    ? { text: t('DEMO FEED', 'የሙከራ ቻናል'), bg: '#d97706' }
    : cam.status === 'online' ? { text: t('● LIVE', '● በቀጥታ'), bg: '#16a34a' } : { text: t('○ OFFLINE', '○ ግንኙነት የለም'), bg: '#57534e' }
  const snapshot = () => {
    const root = wrapRef.current; if (!root) return
    const src: any = root.querySelector('canvas, video')
    if (!src) { toast(t('Nothing to capture yet', 'ለመያዝ ምንም የለም'), false); return }
    try {
      const c = document.createElement('canvas')
      c.width = src.videoWidth || src.width || 640; c.height = src.videoHeight || src.height || 360
      c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height)
      const a = document.createElement('a')
      a.href = c.toDataURL('image/png'); a.download = `${cam.name.replace(/[^a-z0-9]+/gi, '_')}.png`; a.click()
      toast(t('Snapshot saved', 'ቅጽበታዊ ምስል ተቀምጧል'))
    } catch { toast(t('Snapshot blocked by the stream’s CORS policy', 'ቅጽበታዊ ምስል በCORS ፖሊሲ ተከልክሏል'), false) }
  }
  const goFullscreen = () => { wrapRef.current?.requestFullscreen?.().catch(() => onExpand?.()) }
  return (
    <div ref={wrapRef} className="relative rounded-2xl overflow-hidden group" style={{ background: '#000', aspectRatio: '16/9', boxShadow: 'var(--shadow-sm)' }}>
      <div key={epoch} className="absolute inset-0" style={{ cursor: big ? 'default' : 'pointer' }} onClick={!big ? onExpand : undefined}>
        {isDemo ? <DemoFeed cam={cam} label="DEMO" /> : <RealFeed cam={cam} />}
      </div>
      {/* top-left: status */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-white rounded px-1.5 py-0.5" style={{ background: statusChip.bg }}>{statusChip.text}</span>
        {isDemo && <span className="text-[10px] font-semibold text-white/95 rounded px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.55)' }}>{t('SIMULATED VIEW', 'የተመሰለ እይታ')}</span>}
      </div>
      {/* bottom info + controls */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-5 pb-2 flex items-end justify-between gap-2" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.82), transparent)' }}>
        <div className="min-w-0">
          <div className="text-white text-[13px] font-semibold truncate">{cam.name}</div>
          <div className="text-white/70 text-[11px] truncate">{stationName}{cam.area ? ` · ${cam.area}` : ''}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-90">
          <button className="p-1.5 rounded-lg text-white hover:bg-white/20" title={t('Snapshot', 'ቅጽበታዊ ምስል')} onClick={snapshot}><Camera size={big ? 19 : 15} /></button>
          <button className="p-1.5 rounded-lg text-white hover:bg-white/20" title={t('Reconnect', 'እንደገና ቀጣል')} onClick={() => setEpoch(epoch + 1)}><RefreshCw size={big ? 19 : 15} /></button>
          <button className="p-1.5 rounded-lg text-white hover:bg-white/20" title={t('Full screen', 'ሙሉ ማያ')} onClick={goFullscreen}>{big ? <Minimize2 size={19} /> : <Maximize2 size={15} />}</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- the module page ---------------- */
export function SiteMonitoring() {
  const t = useT(); const toast = useToast(); const qc = useQueryClient()
  const camsQ = useList('/site-cameras/'); const cams = camsQ.rows
  const stationsQ = useList('/stations/'); const stations = stationsQ.rows
  const stationById = useMemo(() => new Map(stations.map((s: any) => [s.id, s])), [stations])
  const [stationFilter, setStationFilter] = useState('')
  const [expanded, setExpanded] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const empty = { name: '', station: '', area: '', stream_type: 'demo', stream_url: '', status: 'demo', sort_order: 9, is_active: true }
  const [f, setF] = useState<any>(empty)
  const visible = cams.filter((c: any) => c.is_active !== false && (!stationFilter || c.station === stationFilter))
    .slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const demoCount = visible.filter((c: any) => c.stream_type === 'demo').length
  const liveCount = visible.filter((c: any) => c.stream_type !== 'demo' && c.status === 'online').length
  const save = useMutation({
    mutationFn: () => editing
      ? api(`/api/site-cameras/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(f) })
      : post('/site-cameras/', f),
    onSuccess: () => { toast(editing ? t('Camera updated', 'ካሜራ ተዘምኗል') : t('Camera registered', 'ካሜራ ተመዝግቧል')); setEditing(null); setF(empty); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const remove = useMutation({
    mutationFn: (c: any) => api(`/api/site-cameras/${c.id}/`, { method: 'DELETE' }),
    onSuccess: () => { toast(t('Camera removed', 'ካሜራ ተወግዷል')); qc.invalidateQueries() },
    onError: (e: any) => toast(errMsg(e), false),
  })
  const onType = (v: string) => setF({ ...f, stream_type: v, status: v === 'demo' ? 'demo' : (f.status === 'demo' ? 'online' : f.status) })
  return (<div>
    {/* summary strip */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {[[t('Cameras', 'ካሜራዎች'), visible.length], [t('Sites covered', 'የተሸፈኑ ጣቢያዎች'), new Set(visible.map((c: any) => c.station)).size], [t('Live (real) feeds', 'የቀጥታ (እውነተኛ) ቻናሎች'), liveCount], [t('Demo feeds', 'የሙከራ ቻናሎች'), demoCount]].map(([l, v]) => (
        <div key={String(l)} className="card !p-3"><div className="lbl">{l}</div><div className="text-lg font-bold mt-1">{String(v)}</div></div>))}
    </div>

    <div className="rounded-xl px-3 py-2.5 mb-4 flex gap-2 items-start text-[13px]" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
      <Info size={16} className="shrink-0 mt-0.5" />
      <span>{t('Demo feeds are clearly labelled simulations for layout and training — they are not real camera images. To go live, connect each site’s CCTV/NVR (RTSP) through a streaming gateway (e.g. MediaMTX or Frigate) and register its HLS (.m3u8) URL on the camera below; the tile then plays the real stream.', 'የሙከራ ቻናሎች ለአቀማመጥ እና ለሥልጠና የተዘጋጁ እና በግልጽ የተሰየሙ ምስሎች ናቸው — እውነተኛ የካሜራ ምስሎች አይደሉም። በቀጥታ ለማሳየት የእያንዳንዱ ጣቢያ CCTV/NVR (RTSP) በስትሪሚንግ ጌትዌይ (እንደ MediaMTX ወይም Frigate) አገናኝተው የ HLS (.m3u8) አድራሻውን ከታች ባለው ካሜራ ይመዝግቡ፤ ካርዱ እውነተኛውን ቻናል ያጫውታል።')}</span>
    </div>

    <Section title={t('Site Monitoring — Camera Wall', 'የጣቢያ ክትትል — የካሜራ ግድግዳ')} sub={t('4 × 2 grid on desktop · 2 columns on tablet · stacked on mobile. Hover a tile for snapshot, reconnect, expand and full-screen controls.', 'በዴስክቶፕ 4 × 2 ፍርግርግ · በታብሌት 2 አምዶች · በሞባይል የተቆለለ። ለቅጽበታዊ ምስል፣ እንደገና ግንኙነት፣ ማስፋት እና ሙሉ ማያ ቁጥጥሮች ካርዱ ላይ ያንዣብቡ።')}
      action={<select className="inp !w-auto !py-1.5 text-sm" value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}><option value="">{t('All sites', 'ሁሉም ጣቢያዎች')}</option>{stations.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>}>
      {camsQ.isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="skeleton rounded-2xl" style={{ aspectRatio: '16/9' }} />)}</div>
      : camsQ.isError ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{t('Could not load cameras', 'ካሜራዎችን መጫን አልተቻለም')}: {errMsg(camsQ.error)}</p>
      : visible.length === 0 ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('No cameras for this selection yet — register one below.', 'ለዚህ ምርጫ ገና ካሜራ የለም — ከታች ይመዝግቡ።')}</p>
      : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {visible.map((c: any) => <CameraTile key={c.id} cam={c} stationName={stationById.get(c.station)?.name ?? ''} onExpand={() => setExpanded(c)} />)}
        </div>}
    </Section>

    <Section title={t('Cameras & Real CCTV Integration', 'ካሜራዎች እና እውነተኛ የCCTV ውህደት')} sub={t('Register a real camera by pasting the HLS (.m3u8) or MP4/WebM URL from your NVR/gateway — or keep it as a labelled demo feed. Admins and site managers can manage this register.', 'ከNVR/ጌትዌይዎ የ HLS (.m3u8) ወይም MP4/WebM አድራሻ በመለጠፍ እውነተኛ ካሜራ ይመዝግቡ — ወይም እንደ ተሰየመ የሙከራ ቻናል ያቆዩት።')}>
      <T state={camsQ} rows={cams.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))} cols={[['name', t('Camera', 'ካሜራ')], ['area', t('Watching', 'የሚከታተለው')], ['stream_type', t('Type', 'ዓይነት')], ['status', t('Status', 'ሁኔታ')], ['sort_order', '#'], ['actions', t('Actions', 'እርምጃዎች')]]}
        renderCell={(r: any, k: string) => k === 'actions' ? <span className="inline-flex gap-1">
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => { setEditing(r); setF({ ...empty, ...r }) }}>{t('Edit', 'አርትዕ')}</button>
          <button className="btn-ghost !px-2 !py-1 text-xs" style={{ color: 'var(--danger)' }} onClick={() => { if (window.confirm(`${t('Remove camera', 'ካሜራ አስወግድ')} ${r.name}?`)) remove.mutate(r) }}>{t('Delete', 'ሰርዝ')}</button>
        </span> : undefined} />
      <div className="grid md:grid-cols-4 gap-2 mt-3">
        <Field label={t('Camera name', 'የካሜራ ስም')}><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="CAM 09 — …" /></Field>
        <Field label={t('Site / Station', 'ጣቢያ')}><select className="inp" value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })}><option value="">{t('Select…', 'ምረጥ…')}</option>{stations.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></Field>
        <Field label={t('Watching (area)', 'የሚከታተለው ቦታ')}><input className="inp" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
        <Field label={t('Feed type', 'የቻናል ዓይነት')}><select className="inp" value={f.stream_type} onChange={(e) => onType(e.target.value)}><option value="demo">{t('Demo (simulated)', 'ሙከራ (የተመሰለ)')}</option><option value="hls">HLS (.m3u8)</option><option value="mp4">MP4 / WebM</option></select></Field>
        <Field label={t('Stream URL', 'የቻናል አድራሻ (URL)')}><input className="inp md:col-span-2" value={f.stream_url} onChange={(e) => setF({ ...f, stream_url: e.target.value })} placeholder="https://nvr.site.et/cam1/index.m3u8" /></Field>
        <Field label={t('Status', 'ሁኔታ')}><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="demo">{t('Demo', 'ሙከራ')}</option><option value="online">{t('Online', 'በመስመር ላይ')}</option><option value="offline">{t('Offline', 'ከመስመር ውጪ')}</option></select></Field>
        <Field label={t('Grid order', 'የፍርግርግ ቅደም ተከተል')}><input className="inp" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 mt-3">
        <button className="btn" disabled={!f.name || !f.station || save.isPending} onClick={() => save.mutate()}>{editing ? t('Save camera', 'ካሜራ አስቀምጥ') : t('Register camera', 'ካሜራ መዝግብ')}</button>
        {editing && <button className="btn-ghost" onClick={() => { setEditing(null); setF(empty) }}>{t('Cancel edit', 'አርትዕ ሰርዝ')}</button>}
      </div>
      <ol className="text-xs mt-4 space-y-1 list-decimal list-inside" style={{ color: 'var(--muted)' }}>
        <li>{t('At each site, point the NVR/DVR RTSP output to a small gateway box (MediaMTX or Frigate) on the station network.', 'በእያንዳንዱ ጣቢያ የNVR/DVR RTSP ውጽዓትን በጣቢያ ኔትወርክ ላይ ወዳለ አነስተኛ ጌትዌይ (MediaMTX ወይም Frigate) ያመሩ።')}</li>
        <li>{t('Publish one HLS address per camera, e.g. https://gateway.site.et/cam-reception/index.m3u8 (HTTPS + CORS enabled).', 'ለእያንዳንዱ ካሜራ አንድ የHLS አድራሻ ያትሙ፣ ለምሳሌ https://gateway.site.et/cam-reception/index.m3u8 (HTTPS + CORS የነቃ)።')}</li>
        <li>{t('Register the camera above with that URL and status Online — the wall switches from demo to the real stream immediately.', 'ካሜራውን ከላይ በዚያ አድራሻ እና «በመስመር ላይ» ሁኔታ ይመዝግቡ — ግድግዳው ወዲያውኑ ከሙከራ ወደ እውነተኛ ቻናል ይቀየራል።')}</li>
      </ol>
    </Section>

    {/* expanded / theatre view */}
    {expanded && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(0,0,0,0.88)' }} onClick={() => setExpanded(null)}>
        <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold text-sm sm:text-base">{expanded.name} — {stationById.get(expanded.station)?.name ?? ''}</div>
            <button className="p-2 rounded-lg text-white hover:bg-white/15" onClick={() => setExpanded(null)} aria-label={t('Close', 'ዝጋ')}><X size={20} /></button>
          </div>
          <CameraTile cam={expanded} stationName={stationById.get(expanded.station)?.name ?? ''} big />
          <p className="text-white/60 text-xs mt-2">{expanded.stream_type === 'demo' ? t('Demo feed — simulated view, not a real camera.', 'የሙከራ ቻናል — የተመሰለ እይታ፣ እውነተኛ ካሜራ አይደለም።') : t('Live stream from the site gateway.', 'ከጣቢያ ጌትዌይ የቀጥታ ቻናል።')}</p>
        </div>
      </div>
    )}
  </div>)
}
