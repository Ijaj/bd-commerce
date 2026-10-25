import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database; run them one after another.
    fileParallelism: false,
    // Shared CI runners and busy dev machines are slow; the default 5 s / 10 s flakes.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
  // SWC instead of esbuild: Nest DI needs decorator metadata
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
