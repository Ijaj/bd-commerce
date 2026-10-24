import { randomBytes } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { readSmsCode } from './otp';

export interface ShopCustomer {
  name: string;
  phone: string;
  password: string;
  email?: string;
}

/** Random Bangladesh mobile number (01 + operator 3-9 + 8 digits): unique per run. */
export function uniquePhone(): string {
  const digits = randomBytes(8).readBigUInt64BE() % 100_000_000n;
  return `013${String(digits).padStart(8, '0')}`;
}

/** Signup through the UI, reading the SMS code from the e2e API's outbox (see support/otp.ts). */
export async function signupShopCustomer(page: Page, customer: ShopCustomer) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(customer.name);
  await page.getByLabel('Mobile number', { exact: true }).fill(customer.phone);
  if (customer.email) await page.getByLabel('Email (optional)').fill(customer.email);
  await page.getByLabel('Password', { exact: true }).fill(customer.password);
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page.getByLabel('6-digit code')).toBeVisible();
  await page.getByLabel('6-digit code').fill(await readSmsCode(customer.phone));
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: `Hello, ${customer.name}` })).toBeVisible();
}

/** Login through the UI with a phone number or email. */
export async function loginShopCustomer(page: Page, login: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Mobile number or email').fill(login);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}
