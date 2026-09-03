import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This app is served by the Express backend at the /reports path (see
// backend/src/server.ts), so every asset URL it emits must be prefixed with
// /reports/ — that's what `base` controls.
export default defineConfig({
  plugins: [react()],
  base: '/reports/',
  server: {
    // Local dev: `npm run dev` here proxies /api to a backend running on
    // :5000 (`npm run dev` in backend/), so the app can use plain relative
    // fetch('/api/...') calls in both dev and production.
    proxy: {
      '/api': 'http://localhost:5000',
      '/images': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
