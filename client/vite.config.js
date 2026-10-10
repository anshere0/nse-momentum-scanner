import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/sse': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/auth': 'http://localhost:3000'
    }
  }
})
