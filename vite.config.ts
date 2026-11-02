import { defineConfig, loadEnv } from 'vite'
import { devApi } from './server/devApi.ts'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'VITE_GEMINI_API_KEY', 'VITE_GEMINI_MODEL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_KEY', 'KAKAO_REST_API_KEY', 'GOOGLE_BOOKS_API_KEY']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
  plugins: [
    react(),
    devApi(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        injectionPoint: '__WB_MANIFEST',
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      },
      includeAssets: ['logo.png', 'icons/*.png'],
      manifest: {
        name: '북스탯',
        short_name: '북스탯',
        description: '가족 독서 기록 앱',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'ko',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  };
})
