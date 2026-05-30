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
        background_color: '#f5f2ec',
        theme_color: '#16181c',
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
});
