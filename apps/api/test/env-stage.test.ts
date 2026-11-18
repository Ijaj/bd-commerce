import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  STAFF_TOTP_KEY: 'a'.repeat(64),
  AFFILIATE_PAYOUT_KEY: 'b'.repeat(64),
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'shop <no-reply@example.com>',
  ADMIN_ORIGIN: 'https://admin.example.com',
  S3_ENDPOINT: 'http://garage:3900',
  S3_REGION: 'garage',
  S3_BUCKET_PRODUCTS: 'products',
  S3_ACCESS_KEY_ID: 'GKx',
  S3_SECRET_ACCESS_KEY: 'y',
  IMGPROXY_URL: 'https://img.example.com',
  IMGPROXY_KEY: 'ab',
  IMGPROXY_SALT: 'cd',
  OTP_SECRET: 'x'.repeat(32),
};

describe('APP_STAGE (C94)', () => {
  it('production refuses the dev SMS stub', () => {
    expect(() => loadEnv({ ...base })).toThrow(/SMS_PROVIDER=dev/);
  });
  it('staging allows the dev SMS stub but keeps other production checks', () => {
    expect(loadEnv({ ...base, APP_STAGE: 'staging' }).APP_STAGE).toBe('staging');
    expect(() => loadEnv({ ...base, APP_STAGE: 'staging', DISABLE_2FA: 'true' })).toThrow(
      /DISABLE_2FA/,
    );
    expect(() => loadEnv({ ...base, APP_STAGE: 'staging', OTP_SECRET: undefined })).toThrow(
      /OTP_SECRET/,
    );
  });
});
