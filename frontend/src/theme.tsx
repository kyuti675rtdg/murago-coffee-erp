import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: 'light', toggle: () => {}, setTheme: () => {},
})
export const useTheme = () => useContext(ThemeCtx)

function initialTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme as Theme
  }
  try {
    const saved = localStorage.getItem('murago_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch { return 'light' }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('murago_theme', theme) } catch { /* private mode */ }
    const meta = document.getElementById('meta-theme-color')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12100e' : '#f4f4f2')
  }, [theme])
  const setTheme = (t: Theme) => setThemeState(t)
  const toggle = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  return <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeCtx.Provider>
}
