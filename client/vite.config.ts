import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo>/ and that path is case-sensitive, so this
// must match the repository name exactly. CI overrides it via VITE_BASE,
// derived from the real repo name. Trailing slash required.
const base = process.env.VITE_BASE ?? '/Frame-feud/';

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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Frame Feud',
        short_name: 'Frame Feud',
        description:
          'A turn-based family feud fighting game. Both players pick a move in secret, then every frame plays out at once.',
        theme_color: '#07070c',
        background_color: '#07070c',
        display: 'standalone',
        categories: ['games'],
        // Portrait is a first-class layout (collapsible panel + inset-aware
        // camera), so don't lock installed instances to landscape.
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only the Latin font subsets are needed offline.
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
