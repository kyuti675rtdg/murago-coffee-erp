import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:8910', '/health': 'http://127.0.0.1:8910' } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1600 },
})
