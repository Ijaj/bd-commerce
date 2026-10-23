import { execSync } from 'node:child_process';

/** Points the API at the test database and applies migrations before any test runs. */
export default function setup() {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    // CI provides the variables
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  process.env.DATABASE_URL = url;
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
