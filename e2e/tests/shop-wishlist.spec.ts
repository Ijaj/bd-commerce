import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { signupShopCustomer, uniquePhone } from '../support/shop';

test.use({ baseURL: SHOP_URL });

const PRODUCT = '/p/demo-aarong-classic-panjabi';
const TITLE = 'Aarong Classic Panjabi';

test('wishlist: logged-out heart goes to login, then save and remove', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  const customer = { name: 'Nasima Akter', phone: uniquePhone(), password: 'secret-pass-2' };
  await signupShopCustomer(page, customer);
  await context.clearCookies();

  await page.goto(PRODUCT);
  await page.getByRole('button', { name: 'Wishlist', exact: true }).first().click();
  await expect(page).toHaveURL(/\/login\?next=/);
  const next = new URL(page.url()).searchParams.get('next');
  expect(next).toContain(PRODUCT);

  await page.getByLabel('Mobile number or email').fill(customer.phone);
  await page.getByLabel('Password', { exact: true }).fill(customer.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${PRODUCT}$`));

  const heart = page.getByRole('button', { name: 'Wishlist', exact: true }).first(); // main product, before similar/recent rows
  // The heart updates optimistically; wait for the save before leaving the page.
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().includes('/v1/customer/wishlist/'),
  );
  await heart.click();
  expect((await saved).ok()).toBe(true);

  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { level: 1, name: 'Wishlist' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: TITLE })).toBeVisible();

  await page.getByRole('button', { name: `Remove: ${TITLE}` }).click();
  await expect(page.getByText('Your wishlist is empty')).toBeVisible();

  expect(errors).toEqual([]);
});
