// Prepares a fresh e2e database + Redis db, builds the API and runs it in the foreground.
// Used as the Playwright webServer command so the API never starts against a stale schema.
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const PG = process.env.E2E_PG_CONTAINER ?? 'bdc-dev-postgres-1';
const REDIS = process.env.E2E_REDIS_CONTAINER ?? 'bdc-dev-redis-1';
const DB = 'bdc_e2e';
const engine = (() => {
  for (const bin of ['podman', 'docker']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch {}
  }
  throw new Error('podman or docker is required to reach the dev Postgres/Redis containers');
})();

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
const psql = (sql) =>
  run(engine, [
    'exec',
    PG,
    'psql',
    '-U',
    'bdc',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]);

// Always start from an empty database: drop + create, then apply all migrations.
psql(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
psql(`CREATE DATABASE ${DB}`);
run(engine, ['exec', REDIS, 'redis-cli', '-n', '7', 'FLUSHDB'], { stdio: 'ignore' });

const databaseUrl = `postgresql://bdc:bdc_dev@localhost:5432/${DB}`;
run('pnpm', ['--filter', '@bdc/api', 'exec', 'prisma', 'migrate', 'deploy'], {
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
if (!process.env.E2E_SKIP_BUILD) run('pnpm', ['--filter', '@bdc/api', 'build']);

const child = spawn('node', ['apps/api/dist/main.js'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
