import { expect, type Page } from '@playwright/test';
import { readSmsCode } from './otp';

/** Demo product without options and with plenty of stock (see apps/api seed). */
export const WIPES = { slug: 'demo-pampers-baby-wipes-72', title: 'Pampers Baby Wipes 72 pcs' };

/** Adds the product to the cart from its page and waits for the API to accept the line. */
export async function addToCart(page: Page, slug: string) {
  await page.goto(`/p/${slug}`);
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/v1\/cart\/items\//.test(r.url()),
  );
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  const res = await saved;
  if (!res.ok()) throw new Error(`add to cart failed: ${res.status()} ${await res.text()}`);
}

/** Picks Dhaka > Dhaka > Dhanmondi (an "Inside Dhaka" zone) in the checkout address selects. */
export async function pickDhakaArea(page: Page, upazila = 'Dhanmondi') {
  await page.getByLabel('Division', { exact: true }).selectOption({ label: 'Dhaka' });
  await page.getByLabel('District', { exact: true }).selectOption({ label: 'Dhaka' });
  await page.getByLabel('Upazila / thana', { exact: true }).selectOption({ label: upazila });
}

/** Waits for the quote: the summary shows the delivery estimate once a zone is matched. */
export async function expectQuote(page: Page) {
  await expect(page.getByText(/^Estimated delivery:/).first()).toBeVisible();
}

/** Places the order and returns the order number from the success URL (/order/<no>). */
export async function placeOrder(page: Page) {
  await page.getByRole('button', { name: 'Place order' }).click();
  await page.waitForURL(/\/order\/[^/?#]+$/);
  const orderNo = /\/order\/([^/?#]+)$/.exec(new URL(page.url()).pathname)?.[1];
  if (!orderNo) throw new Error(`no order number in ${page.url()}`);
  await expect(page.getByText('Thank you for your order').first()).toBeVisible();
  return orderNo;
}

/** Sends the guest COD code and types the one the API recorded (only when the OTP threshold applies). */
export async function verifyGuestPhone(page: Page, phone: string) {
  const sent = page.waitForResponse((r) => /\/v1\/checkout\/otp/.test(r.url()));
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  expect((await sent).ok()).toBeTruthy();
  await page.getByLabel('6-digit code', { exact: true }).fill(await readSmsCode(phone));
}

export { readSmsCode };
