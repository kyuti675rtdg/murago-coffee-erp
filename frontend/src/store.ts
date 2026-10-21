import { create } from 'zustand'
import { api, setToken } from './api'

interface AuthState {
  user: any | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restore: () => Promise<void>
}
export const useAuth = create<AuthState>((set) => ({
  user: null, ready: false,
  login: async (username, password) => {
    const data = await api('/api/auth/login/', { method: 'POST', body: JSON.stringify({ username, password }) })
    setToken(data.token); set({ user: data.user, ready: true })
  },
  logout: async () => { try { await api('/api/auth/logout/', { method: 'POST', body: '{}' }) } catch { /* token gone anyway */ } setToken(null); set({ user: null }) },
  restore: async () => {
    try { const me = await api('/api/auth/me/'); set({ user: me, ready: true }) }
    catch { set({ user: null, ready: true }) }
  },
}))

/* Workspace station context — set by the topbar station switcher, persisted,
   and used as the default station in form StationSelects across the app. */
interface StationCtx { stationId: string; setStationId: (id: string) => void }
export const useStationCtx = create<StationCtx>((set) => ({
  stationId: (() => { try { return localStorage.getItem('murago_station') || '' } catch { return '' } })(),
  setStationId: (id) => { try { id ? localStorage.setItem('murago_station', id) : localStorage.removeItem('murago_station') } catch { /* ignore */ } set({ stationId: id }) },
}))
