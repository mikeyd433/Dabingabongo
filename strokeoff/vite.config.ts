/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Theme color matches the `stat-sheet` default theme accent (see src/themes/statSheet.ts).
const THEME_COLOR = '#1d4ed8'

export default defineConfig({
  // Stroke Off is served from a sub-path of dabingabongo.com (vendored alongside
  // the brainstorm/ and harmony/ apps). Assets, router basename, and the PWA
  // manifest scope all key off this single value.
  base: '/strokeoff/',
  build: {
    // Emit into the website's shared dist/ so build.sh publishes it as one site.
    outDir: '../dist/strokeoff',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Stroke Off',
        short_name: 'Stroke Off',
        description:
          'A points-based disc golf side-game that runs parallel to your round.',
        display: 'standalone',
        start_url: '/strokeoff/',
        scope: '/strokeoff/',
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
