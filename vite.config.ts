import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png','pwa-192.png','pwa-512.png','pwa-maskable-512.png'],
      manifest: {
        name: 'Amar Hisab',
        short_name: 'Amar Hisab',
        description: 'Personal finance, income, expenses and debt manager.',
        theme_color: '#7968e9',
        background_color: '#f8f5ff',
        display: 'standalone',
        id: '/',
        lang: 'bn',
        categories: ['finance','productivity'],
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: []
      }
    })
  ]
});
