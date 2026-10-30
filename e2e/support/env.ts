import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const API_PORT = 4100;
export const ADMIN_PORT = 5180;
export const ADMIN_URL = `http://localhost:${ADMIN_PORT}`;
export const SHOP_PORT = 3180;
export const SHOP_URL = `http://localhost:${SHOP_PORT}`;
export const PORTAL_PORT = 5191;
export const PORTAL_URL = `http://localhost:${PORTAL_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;
export const DB_NAME = 'bdc_e2e';
export const DATABASE_URL = `postgresql://bdc:bdc_dev@localhost:5432/${DB_NAME}`;
export const REDIS_DB = 7;
export const REDIS_URL = `redis://localhost:6379/${REDIS_DB}`;
export const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'bdc-dev-postgres-1';
export const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? 'bdc-dev-redis-1';

/** Environment for the API process and its CLI: root .env values, then the e2e overrides. */
export function apiEnv(): NodeJS.ProcessEnv {
  try {
    // Does not override variables that are already set.
    process.loadEnvFile(resolve(ROOT, '.env'));
  } catch {
    // no .env (CI): variables come from the environment
  }
  return {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    DATABASE_URL,
    REDIS_URL,
    ADMIN_ORIGIN: ADMIN_URL,
    // Keep browser tests exercising the normal MFA flow even when local development disables it.
    DISABLE_2FA: 'false',
    // Lets the e2e read SMS codes (GET /v1/test/last-sms) and builds memo links on the e2e origin.
    E2E_EXPOSE_OTP: '1',
    PUBLIC_API_URL: API_URL,
  };
}

/** Environment for the shop build and server: talks to the e2e API and emits e2e URLs. */
export function shopEnv(): NodeJS.ProcessEnv {
  return { ...process.env, API_URL, SITE_URL: SHOP_URL } as NodeJS.ProcessEnv;
}
