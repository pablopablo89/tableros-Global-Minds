import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El proxy /api funciona en Vercel (serverless) y en dev local (vite proxy → función).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
