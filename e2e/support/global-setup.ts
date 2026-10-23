import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createOwnerViaCli, loginAndSetup2fa } from './accounts';
import { ADMIN_URL } from './env';

export const AUTH_DIR = resolve(import.meta.dirname, '..', '.auth');
export const OWNER_STATE = resolve(AUTH_DIR, 'owner.json');
export const OWNER_META = resolve(AUTH_DIR, 'owner-account.json');

/** Database and API are prepared by support/start-api.mjs (webServer); this creates the shared Owner. */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  const owner = createOwnerViaCli('e2e-owner@bdc.test', 'E2E Owner');
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: ADMIN_URL });
  const page = await context.newPage();
  const done = await loginAndSetup2fa(page, owner);
  await context.storageState({ path: OWNER_STATE });
  writeFileSync(OWNER_META, JSON.stringify(done, null, 2));
  await browser.close();
}
