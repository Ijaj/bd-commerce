import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  STAFF_TOTP_KEY: z.string().regex(/^[0-9a-f]{64}$/, '32-byte hex key'),
  SMTP_URL: z.url(),
  MAIL_FROM: z.string().min(3),
  ADMIN_ORIGIN: z.url(),
  /// Public origin of this API, used to build share links (SR memo links).
  PUBLIC_API_URL: z.url().default('http://localhost:4000'),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET_PRODUCTS: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /// Public base URL of imgproxy (signed URLs, s3:// sources).
  IMGPROXY_URL: z.url(),
  IMGPROXY_KEY: z.string().regex(/^[0-9a-f]+$/, 'hex'),
  IMGPROXY_SALT: z.string().regex(/^[0-9a-f]+$/, 'hex'),
  /// HMAC key for SMS one-time codes. Required in production; development falls back to a fixed key.
  OTP_SECRET: z.string().min(16).optional(),
  /// Only `dev` exists (Mailpit / test outbox) until the SMS gateway is chosen (Q75).
  SMS_PROVIDER: z.enum(['dev']).default('dev'),
  /// Courier credentials (C51). All optional: a courier without keys can't book (NOT_CONFIGURED); `fake` needs none.
  STEADFAST_BASE_URL: z.url().default('https://portal.packzy.com/api/v1'),
  STEADFAST_API_KEY: z.string().optional(),
  STEADFAST_SECRET_KEY: z.string().optional(),
  /// Shared secret Steadfast sends as Bearer token on webhooks.
  STEADFAST_WEBHOOK_TOKEN: z.string().optional(),
  PATHAO_BASE_URL: z.url().default('https://api-hermes.pathao.com'),
  PATHAO_CLIENT_ID: z.string().optional(),
  PATHAO_CLIENT_SECRET: z.string().optional(),
  PATHAO_USERNAME: z.string().optional(),
  PATHAO_PASSWORD: z.string().optional(),
  PATHAO_STORE_ID: z.string().optional(),
  PATHAO_WEBHOOK_SECRET: z.string().optional(),
  /// e2e only: serves GET /v1/test/last-sms. Refused when NODE_ENV=production.
  E2E_EXPOSE_OTP: z.enum(['0', '1']).default('0'),
  /// Trust `cf-connecting-ip` (API reachable only through the Cloudflare Tunnel) when the peer is local.
  TRUST_CF_HEADER: z.enum(['0', '1']).default('0'),
  /// Express `trust proxy`: false, true, a hop count, or a comma list of subnets.
  TRUST_PROXY: z.string().default('false'),
  /// Listen address. Default: 127.0.0.1 in production, 0.0.0.0 otherwise.
  HOST: z.string().min(1).optional(),
});

const DEV_OTP_SECRET = 'dev-only-otp-secret-not-for-production';

export type Env = Omit<z.infer<typeof envSchema>, 'OTP_SECRET'> & { OTP_SECRET: string };

export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    if (!env.OTP_SECRET)
      throw new Error('Invalid environment:\nOTP_SECRET is required in production');
    if (env.E2E_EXPOSE_OTP === '1') {
      throw new Error('Invalid environment:\nE2E_EXPOSE_OTP must not be set in production');
    }
  }
  return { ...env, OTP_SECRET: env.OTP_SECRET ?? DEV_OTP_SECRET };
}
