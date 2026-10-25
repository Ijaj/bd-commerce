import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.API_URL ?? 'http://localhost:4000';
// "View store" link in the top bar; dev.sh exports SITE_URL.
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(SITE_URL) },
  resolve: { alias: { '~': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5173,
    // Same-origin API so the httpOnly session cookie works without CORS.
    proxy: { '/v1': { target: API_TARGET, changeOrigin: true } },
  },
  preview: { port: 5173, proxy: { '/v1': { target: API_TARGET, changeOrigin: true } } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
