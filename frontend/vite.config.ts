import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  // Read VITE_* variables from the repository-root .env. Only VITE_-prefixed
  // variables are ever exposed to browser code.
  envDir: '..',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        id: '/',
        name: 'RESQNET — Emergency & Safety Network',
        short_name: 'RESQNET',
        description:
          'Offline-first emergency help: request rescue, find shelters, read safety guides and contact emergency services — even without internet.',
        lang: 'en',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#b42318',
        categories: ['utilities', 'medical', 'navigation'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Request help', short_name: 'Help', url: '/sos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Find shelter', short_name: 'Shelters', url: '/shelters', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Emergency contacts', short_name: 'Contacts', url: '/contacts', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[/](react|react-dom|react-router|scheduler)[/]/.test(id)) return 'react';
          if (/[/](dexie|dexie-react-hooks|zod)[/]/.test(id)) return 'data';
          if (/[/](react-hook-form|@hookform)[/]/.test(id)) return 'forms';
          return undefined;
        },
      },
    },
  },
});
