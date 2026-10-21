import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './theme'
import { LangProvider } from './i18n'
import './index.css'

if ('serviceWorker' in navigator) {
  // When a new service worker takes control (a fresh deployment), reload
  // once so the open tab can never keep running a stale build.
  let swReloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return
    swReloaded = true
    window.location.reload()
  })
  window.addEventListener('load', () => navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {}))
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } })
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={qc}><ThemeProvider><LangProvider><App /></LangProvider></ThemeProvider></QueryClientProvider></React.StrictMode>)
