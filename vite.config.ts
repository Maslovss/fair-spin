import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/fair-spin/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
      manifest: {
        name: 'Fair Spin',
        short_name: 'Fair Spin',
        description: 'A tactile, honest randomizer whose result comes from motion.',
        theme_color: '#17130f',
        background_color: '#f3ead8',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: []
      }
    })
  ]
})
