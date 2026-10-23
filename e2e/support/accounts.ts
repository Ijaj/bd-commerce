import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { apiEnv, ROOT } from './env';
import { nextTotp } from './totp';

export interface Account {
  email: string;
  name: string;
  password: string;
  secret?: string;
  backupCodes?: string[];
}

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${randomBytes(3).toString('hex')}@bdc.test`;

/** Creates an Owner through the API's CLI (the only way across processes). */
export function createOwnerViaCli(email: string, name: string): Account {
  const out = execFileSync('node', ['apps/api/dist/cli.js', 'create-owner', email, name], {
    cwd: ROOT,
    env: apiEnv(),
    encoding: 'utf8',
  });
  const password = /Temporary password: (\S+)/.exec(out)?.[1];
  if (!password) throw new Error(`Could not parse temp password from CLI output:\n${out}`);
  return { email, name, password };
}

export async function submitLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Types a code into Mantine's PinInput (six single-digit inputs). */
export async function enterPin(page: Page, code: string) {
  const pins = page.locator('input.mantine-PinInput-input');
  await expect(pins).toHaveCount(6);
  await pins.first().click();
  await page.keyboard.type(code, { delay: 30 });
}

/** Login (first time): completes 2FA setup and acknowledges the backup codes. */
export async function loginAndSetup2fa(page: Page, account: Account): Promise<Account> {
  await submitLogin(page, account.email, account.password);
  await expect(page.getByRole('heading', { name: 'Set up two-factor' })).toBeVisible();
  const secret = (await page.locator('code').first().textContent())?.trim();
  if (!secret) throw new Error('2FA secret not shown');
  await enterPin(page, await nextTotp(secret));
  await expect(page.getByRole('heading', { name: 'Save your backup codes' })).toBeVisible();
  const backupCodes = (await page.locator('code').allInnerTexts()).map((c) => c.trim());
  await page.getByLabel('I saved these codes somewhere safe').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  return { ...account, secret, backupCodes };
}

/** Login for an account that already has 2FA: password then authenticator code. */
export async function loginWith2fa(page: Page, account: Account) {
  if (!account.secret) throw new Error('account has no 2FA secret');
  await submitLogin(page, account.email, account.password);
  await expect(page.getByRole('heading', { name: 'Two-factor code' })).toBeVisible();
  await enterPin(page, await nextTotp(account.secret));
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
