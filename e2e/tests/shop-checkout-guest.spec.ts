import { expect, test } from '@playwright/test';
import { ADMIN_URL, SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';
import { uniquePhone } from '../support/shop';
import {
  addToCart,
  expectQuote,
  pickDhakaArea,
  placeOrder,
  verifyGuestPhone,
  WIPES,
} from '../support/storefront';

test.use({ baseURL: SHOP_URL });

const GUEST = { name: 'Karim Hossain' };

async function fillGuest(page: import('@playwright/test').Page, phone: string) {
  await page.getByLabel('Full name', { exact: true }).fill(GUEST.name);
  await page.getByLabel('Mobile number', { exact: true }).fill(phone);
  await pickDhakaArea(page);
  await page.getByLabel('Address', { exact: true }).fill('House 12, Road 5');
}

test('guest COD: cart, checkout with a Dhaka address, place, track the order', async ({ page }) => {
  const errors = watchErrors(page);
  const phone = uniquePhone();
  await addToCart(page, WIPES.slug);

  await page.goto('/cart');
  await expect(page.getByText(WIPES.title).first()).toBeVisible();
  await page
    .getByRole('link', { name: /^Checkout/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/checkout/);

  await fillGuest(page, phone);
  await expectQuote(page);
  const orderNo = await placeOrder(page);

  await page.goto('/track');
  await page.getByLabel('Order number', { exact: true }).fill(orderNo);
  await page.getByLabel('Phone number', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Track order', exact: true }).click();
  await expect(page.getByText('Order status').first()).toBeVisible();
  await expect(page.getByText('Processing').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('guest above the OTP threshold verifies the phone by SMS before placing', async ({
  page,
  playwright,
}) => {
  const errors = watchErrors(page);
  const phone = uniquePhone();
  // Owner API session: lower the guest OTP threshold for this test only.
  const admin = await playwright.request.newContext({
    baseURL: ADMIN_URL,
    storageState: OWNER_STATE,
  });
  const setCheckout = (value: object) =>
    admin.put('/v1/admin/settings/checkout', { data: { value } });
  const original = await (await admin.get('/v1/admin/settings')).json();
  const before = original.find((s: { key: string }) => s.key === 'checkout')?.value ?? {
    guestOtpAboveP: 500000,
    maxQtyPerLine: 10,
  };
  expect((await setCheckout({ ...before, guestOtpAboveP: 1 })).ok()).toBeTruthy();

  try {
    await addToCart(page, WIPES.slug);
    await page.goto('/checkout');
    await fillGuest(page, phone);
    await expectQuote(page);

    await verifyGuestPhone(page, phone);
    await placeOrder(page);
  } finally {
    await setCheckout(before);
    await admin.dispose();
  }

  expect(errors).toEqual([]);
});
