import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';

test.use({ baseURL: SHOP_URL });

test('language: switch to Bangla under /bn and back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('link', { name: 'বাং', exact: true }).first().click();
  await expect(page).toHaveURL(/\/bn\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');

  await page.getByRole('link', { name: 'EN', exact: true }).first().click();
  await expect(page).not.toHaveURL(/\/bn/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  expect(errors).toEqual([]);
});
