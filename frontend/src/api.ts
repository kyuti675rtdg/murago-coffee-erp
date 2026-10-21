/* API client: Token auth (Phase 2 choice). Live deployment always uses real
   APIs; demo fallback is DEV-only and clearly labelled in the UI. */
export const DEMO_MODE = import.meta.env.DEV

export function getToken(): string | null { return localStorage.getItem('murago_token') }
export function setToken(t: string | null) { t ? localStorage.setItem('murago_token', t) : localStorage.removeItem('murago_token') }

export class ApiError extends Error { status: number; body: any; constructor(status: number, body: any) { super(body?.detail || `HTTP ${status}`); this.status = status; this.body = body } }

export async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const t = getToken(); if (t) headers.Authorization = `Token ${t}`
  const res = await fetch(path.startsWith('/api') ? path : `/api/${path}`, { ...opts, headers })
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body)
  return body
}
export const list = async (path: string): Promise<any[]> => {
  const data = await api(path)
  return Array.isArray(data) ? data : (data.results ?? [])
}
export const post = (path: string, payload: any = {}) => api(path, { method: 'POST', body: JSON.stringify(payload) })

/* ---- Offline queue (IndexedDB) for the field app (Module 21) ---- */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('murago-field', 1)
    req.onupgradeneeded = () => { req.result.createObjectStore('queue', { keyPath: 'client_uuid' }) }
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error)
  })
}
export async function queueOffline(record: any): Promise<void> {
  const db = await idb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').put(record)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  })
  try { const reg: any = await navigator.serviceWorker?.ready; await reg?.sync?.register('murago-sync') } catch { /* unsupported */ }
}
export async function queuedRecords(): Promise<any[]> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const out: any[] = []; const cur = db.transaction('queue').objectStore('queue').openCursor()
    cur.onsuccess = () => { const c = cur.result; if (c) { out.push(c.value); c.continue() } else resolve(out) }
    cur.onerror = () => reject(cur.error)
  })
}
export async function clearQueued(uuids: string[]): Promise<void> {
  const db = await idb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite'); const st = tx.objectStore('queue')
    uuids.forEach((u) => st.delete(u)); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  })
}
export function uuidv7(): string {
  const now = Date.now()
  const b = new Uint8Array(16); crypto.getRandomValues(b)
  b[0] = (now / 2 ** 40) & 255; b[1] = (now / 2 ** 32) & 255; b[2] = (now / 2 ** 24) & 255
  b[3] = (now / 2 ** 16) & 255; b[4] = (now / 2 ** 8) & 255; b[5] = now & 255
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
