/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// Dev: `npm run dev` serves the app over HTTPS (needed on phones for wake lock / PWA)
// and proxies the PocketBase API, so the app always talks to its own origin.
const PB_DEV = process.env.PB_URL || 'http://127.0.0.1:8090'

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    // HTTPS only for the dev server on the phone; previews/tests use plain http
    ...(command === 'serve' && mode !== 'plain' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      workbox: {
        // API calls must never come from the cache
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
      },
      manifest: {
        name: 'Darts Scoreboard',
        short_name: 'Darts',
        description: 'Darts Scoreboard für X01 und Cricket – lokal und online',
        lang: 'de',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: PB_DEV, changeOrigin: true },
      '/_': { target: PB_DEV, changeOrigin: true },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
