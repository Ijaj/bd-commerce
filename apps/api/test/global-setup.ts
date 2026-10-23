import { execSync } from 'node:child_process';

/** Points the API at the test database (and Redis db 1) and applies migrations before any test runs. */
export default function setup() {
  try {
    process.loadEnvFile('../../.env');
  } catch {
    // CI provides the variables
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  process.env.DATABASE_URL = url;

  const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  redis.pathname = '/1';
  process.env.REDIS_URL = redis.toString();

  process.env.STAFF_TOTP_KEY ??= 'a'.repeat(64);
  process.env.SMTP_URL ??= 'smtp://localhost:1025';
  process.env.MAIL_FROM ??= 'test@localhost';
  process.env.ADMIN_ORIGIN ??= 'http://localhost:5173';
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
