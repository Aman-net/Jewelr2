import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Jewelr',
        short_name: 'Jewelr',
        description: 'Wholesale jewellery party ledger. Local-first; data stays on this device.',
        theme_color: '#92400e',
        background_color: '#f5f5f4',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Hash routing: every in-app navigation is same-document, so the
        // precached shell is all offline needs. No sync queue by design.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  test: {
    exclude: ['node_modules', 'dist', 'e2e'],
    alias: {
      'virtual:pwa-register/react': new URL('./src/test/pwa-stub.ts', import.meta.url).pathname,
    },
  },
})
