import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9003,
    allowedHosts: ["bid.devbot.me"],
  },
  preview: {
    allowedHosts: ["bid.devbot.me"],
    port: 9003,
  }
})
