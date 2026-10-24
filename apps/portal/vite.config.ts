import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  resolve: { alias: { '~': new URL('./src', import.meta.url).pathname } },
  server: {
    port: 5190,
    // Same-origin API so the httpOnly session cookie works without CORS.
    proxy: { '/v1': { target: API_TARGET, changeOrigin: true } },
  },
  preview: { port: 5190, proxy: { '/v1': { target: API_TARGET, changeOrigin: true } } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
