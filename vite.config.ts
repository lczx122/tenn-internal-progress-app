import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // A fresh id every build — appended to the quotation.html iframe URL so a new
  // deploy is never served from a stale browser/CDN cache.
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  server: {
    host: true,
    port: 5173,
  },
})
