import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/openaq': {
        target: 'https://api.openaq.org', // The external API
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openaq/, '') // Remove '/openaq' before sending
      }
    }
  }
})
