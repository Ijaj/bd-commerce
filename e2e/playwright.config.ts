import { defineConfig, devices } from '@playwright/test';
import { ADMIN_PORT, ADMIN_URL, API_PORT, API_URL, apiEnv } from './support/env';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  globalSetup: './support/global-setup.ts',
  // One database, one shared Owner: keep it serial and deterministic.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: ADMIN_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node support/start-api.mjs',
      url: `${API_URL}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: apiEnv() as Record<string, string>,
      stdout: 'ignore',
      stderr: 'pipe',
      name: `api:${API_PORT}`,
    },
    {
      command: `pnpm --filter @bdc/admin exec vite --port ${ADMIN_PORT} --strictPort`,
      url: ADMIN_URL,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...process.env, API_URL } as Record<string, string>,
      name: `admin:${ADMIN_PORT}`,
    },
  ],
});
