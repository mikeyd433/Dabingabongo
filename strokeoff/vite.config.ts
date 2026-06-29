/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Theme color matches the `stat-sheet` default theme accent (see src/themes/statSheet.ts).
const THEME_COLOR = '#1d4ed8'

// Sub-path of dabingabongo.com — Vite base, manifest scope/start_url, and the
// service worker's navigate fallback all key off this single value.
const BASE = '/strokeoff/'

export default defineConfig({
  // Stroke Off is served from a sub-path of dabingabongo.com (vendored alongside
  // the brainstorm/ and harmony/ apps). Assets, router basename, and the PWA
  // manifest scope all key off this single value.
  base: BASE,
  build: {
    // Emit into the website's shared dist/ so build.sh publishes it as one site.
    outDir: '../dist/strokeoff',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Isolate the heavy, lazily-loaded libraries in predictably-named chunks
        // so they're fetched on demand and kept out of the offline precache: the
        // QR decoder (only when scanning) and the Lottie player (only when a
        // custom animation plays).
        manualChunks: {
          zxing: ['@zxing/browser', '@zxing/library'],
          lottie: ['lottie-web'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      // Phase 10 — make the shell open offline and survive patchy course signal.
      workbox: {
        // Precache the built shell + assets so the app launches with no network.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // …but not the lazily-loaded QR decoder / Lottie player — they're only
        // needed for an explicit action (scanning, a custom animation), so
        // they're fetched on demand rather than bloating the offline install.
        globIgnores: ['**/zxing-*.js', '**/lottie-*.js'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA: serve the cached app shell for any in-app navigation while offline.
        navigateFallback: `${BASE}index.html`,
        // Never hijack the SW script itself or Supabase auth/api round-trips.
        navigateFallbackDenylist: [/sw\.js$/, /\/auth\//, /\/rest\//],
        runtimeCaching: [
          {
            // Same-origin images not in the precache (e.g. future avatars).
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'so-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Stroke Off',
        short_name: 'Stroke Off',
        description:
          'A points-based disc golf side-game that runs parallel to your round.',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        background_color: '#ffffff',
        theme_color: THEME_COLOR,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
