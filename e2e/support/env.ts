import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const API_PORT = 4100;
export const ADMIN_PORT = 5180;
export const ADMIN_URL = `http://localhost:${ADMIN_PORT}`;
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
  };
}
