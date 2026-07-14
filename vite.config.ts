import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sopralluoghi',
        short_name: 'Sopralluoghi',
        display: 'standalone',
        background_color: '#f6f3ec',
        theme_color: '#1b1c1f',
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff}'] },
    }),
  ],
});
