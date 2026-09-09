import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { npmScriptsPlugin } from './scripts/vite-npm-scripts.mjs'
import { testCatalogPlugin } from './scripts/vite-test-catalog.mjs'
import { documentTemplatesPlugin } from './scripts/vite-document-templates.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), testCatalogPlugin(), npmScriptsPlugin(), documentTemplatesPlugin()],
  base: './',
  server: {
    // Reachable from Android emulator (10.0.2.2) and physical devices on LAN.
    host: true,
    proxy: {
      '/api': {
        // Prefer IPv4 loopback — `localhost` can hit ::1 on Windows and flake.
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        timeout: 60_000,
        proxyTimeout: 60_000,
      },
    },
    // Capacitor native projects + build junk must not trigger HMR / full reloads
    // (and on Windows can destabilize the Vite process).
    watch: {
      ignored: [
        '**/android/**',
        '**/ios/**',
        '**/storage/**',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})

