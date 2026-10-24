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
        theme_color: '#047857', // brand-700
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
        // Aparece en el menú "Compartir" de Android (con la app instalada). El texto
        // llega como ./?compartido-texto=... y src/lib/shareTarget.ts lo manda al
        // formulario. Los nombres deben coincidir con SHARE_PARAMS.
        share_target: {
          action: './',
          method: 'GET',
          params: {
            title: 'compartido-titulo',
            text: 'compartido-texto',
            url: 'compartido-enlace',
          },
        },
        // Accesos directos al mantener presionado el ícono de la app (Android);
        // se pueden arrastrar a la pantalla de inicio como íconos propios.
        shortcuts: [
          {
            name: 'Gasto por voz',
            short_name: 'Por voz',
            description: 'Dictar un movimiento nuevo',
            url: './#/movimientos/nuevo?voz=1',
            icons: [
              {
                src: 'shortcut-voice-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
          {
            name: 'Nuevo movimiento',
            short_name: 'Nuevo',
            url: './#/movimientos/nuevo',
            icons: [
              {
                src: 'shortcut-new-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
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
