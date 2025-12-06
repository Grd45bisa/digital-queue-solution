import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5100,
    allowedHosts: true, // Disable host checking for development (allow all hosts)
    strictPort: true, // Enforce port 5100
    open: false // Don't auto-open browser
  },
  preview: {
    host: '0.0.0.0',
    port: 5100,
    allowedHosts: true, // Disable host checking for preview (allow all hosts)
    strictPort: true
  },
  build: {
    outDir: 'dist',
  },
})
