// Waits for the e2e API, builds the shop against it and serves the build in the foreground.
// Used as a Playwright webServer; the build bakes API_URL into the /v1 rewrite, so it must run
// with the same env as `next start`.
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { API_URL, SHOP_PORT, SHOP_URL } from './env.ts';

const root = resolve(import.meta.dirname, '..', '..');
const env = { ...process.env, API_URL, SITE_URL: SHOP_URL };

for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${API_URL}/health`)).ok) break;
  } catch {}
  if (i > 300) throw new Error(`API did not become healthy at ${API_URL}`);
  await new Promise((r) => setTimeout(r, 1000));
}

if (!process.env.E2E_SKIP_BUILD) {
  execFileSync('pnpm', ['--filter', './apps/shop', 'exec', 'next', 'build'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
}

const child = spawn(
  'pnpm',
  ['--filter', './apps/shop', 'exec', 'next', 'start', '-p', String(SHOP_PORT)],
  {
    cwd: root,
    stdio: 'inherit',
    env,
  },
);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
