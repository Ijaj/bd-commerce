import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { loginShopCustomer, signupShopCustomer, uniquePhone } from '../support/shop';

test.use({ baseURL: SHOP_URL });

test('account: signup with SMS code, logout, login with phone and password', async ({ page }) => {
  const errors = watchErrors(page);
  const customer = { name: 'Rahim Uddin', phone: uniquePhone(), password: 'secret-pass-1' };

  await signupShopCustomer(page, customer);
  await expect(page.getByRole('link', { name: `Account: ${customer.name}` })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login/);

  await loginShopCustomer(page, customer.phone, customer.password);
  await expect(page.getByRole('heading', { name: `Hello, ${customer.name}` })).toBeVisible();

  expect(errors).toEqual([]);
});
