import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: el build funciona igual en la raíz de un dominio o en una
  // subcarpeta (p. ej. usuario.github.io/gastosapp/). Las rutas de la app van en el hash.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': cuando hay una versión nueva se pregunta antes de recargar, para no
      // interrumpir a alguien a media captura.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GastosApp',
        short_name: 'Gastos',
        description:
          'Gastos de tarjeta de crédito: fechas de corte, fecha límite y pago para no generar intereses.',
        lang: 'es-MX',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f1f5f9',
        theme_color: '#4f46e5',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Todo el build queda en caché para funcionar sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
