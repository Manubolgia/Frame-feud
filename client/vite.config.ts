import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo>/. Override with VITE_BASE if your repo
// name differs. Trailing slash required.
const base = process.env.VITE_BASE ?? '/frame-feud/';

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Frame Feud',
        short_name: 'FrameFeud',
        description:
          'A 4-player platform fighter with simultaneous turn-based combat. Plan blind, lock in, watch it resolve.',
        theme_color: '#6c4cff',
        background_color: '#0c0c1a',
        display: 'standalone',
        orientation: 'landscape',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
