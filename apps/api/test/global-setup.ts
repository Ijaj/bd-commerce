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
  // Parallel test runs (one per worktree/agent) pick their own Redis db via TEST_REDIS_DB.
  redis.pathname = `/${process.env.TEST_REDIS_DB ?? '1'}`;
  process.env.REDIS_URL = redis.toString();

  process.env.STAFF_TOTP_KEY ??= 'a'.repeat(64);
  process.env.SMTP_URL ??= 'smtp://localhost:1025';
  process.env.MAIL_FROM ??= 'test@localhost';
  process.env.ADMIN_ORIGIN ??= 'http://localhost:5173';
  // Tests swap object storage for an in-memory fake; these only satisfy env validation.
  process.env.S3_ENDPOINT ??= 'http://localhost:3900';
  process.env.S3_REGION ??= 'garage';
  process.env.S3_BUCKET_PRODUCTS ??= 'products';
  process.env.S3_ACCESS_KEY_ID ??= 'test';
  process.env.S3_SECRET_ACCESS_KEY ??= 'test';
  process.env.IMGPROXY_URL ??= 'http://localhost:8080';
  process.env.IMGPROXY_KEY ??= 'ab'.repeat(32);
  process.env.IMGPROXY_SALT ??= 'cd'.repeat(32);
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
