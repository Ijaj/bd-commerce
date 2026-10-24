import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { signupShopCustomer, uniquePhone } from '../support/shop';
import { addToCart, expectQuote, pickDhakaArea, placeOrder, WIPES } from '../support/storefront';

test.use({ baseURL: SHOP_URL });

test('logged-in checkout saves a new address; the order shows in account orders', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const customer = { name: 'Salma Begum', phone: uniquePhone(), password: 'secret-pass-3' };
  await signupShopCustomer(page, customer);

  await addToCart(page, WIPES.slug);
  await page.goto('/checkout');
  await expect(page.getByLabel('Recipient name', { exact: true })).toHaveValue(customer.name);
  await pickDhakaArea(page);
  await page.getByLabel('Address', { exact: true }).fill('Flat 4B, Road 8');
  await expectQuote(page);
  const orderNo = await placeOrder(page);

  await page.goto('/account/orders');
  await page.locator(`a[href$="/account/orders/${orderNo}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/account/orders/${orderNo}$`));
  await expect(page.getByRole('heading', { name: `Order ${orderNo}` })).toBeVisible();
  await expect(page.getByText(WIPES.title).first()).toBeVisible();

  await page.goto('/account/addresses');
  await expect(page.getByText('Dhanmondi, Dhaka').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('a guest cart is merged into the account on login', async ({ page, context }) => {
  const errors = watchErrors(page);
  const customer = { name: 'Abdul Halim', phone: uniquePhone(), password: 'secret-pass-4' };
  await signupShopCustomer(page, customer);
  await context.clearCookies();

  await addToCart(page, WIPES.slug);
  await page.goto('/login');
  await page.getByLabel('Mobile number or email').fill(customer.phone);
  await page.getByLabel('Password', { exact: true }).fill(customer.password);
  const login = page.waitForResponse((r) => r.url().includes('/v1/customer/auth/login'));
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  expect((await login).ok()).toBeTruthy();

  await page.goto('/cart');
  await expect(page.getByText(WIPES.title).first()).toBeVisible();

  expect(errors).toEqual([]);
});
