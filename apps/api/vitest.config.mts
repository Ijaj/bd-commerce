import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database; run them one after another.
    fileParallelism: false,
  },
  // SWC instead of esbuild: Nest DI needs decorator metadata
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
