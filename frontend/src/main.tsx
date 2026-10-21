import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {}))
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } })
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={qc}><App /></QueryClientProvider></React.StrictMode>)
