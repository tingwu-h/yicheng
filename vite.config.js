import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    open: false,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:5181' },
    watch: {
      ignored: ['**/public/models/**'],
    },
  },
})
