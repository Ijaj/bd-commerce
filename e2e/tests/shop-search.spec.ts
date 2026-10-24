import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';

test.use({ baseURL: SHOP_URL });

test('search: suggestions, then results page; a typo still finds the product', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'Search' });

  await box.fill('Samsung');
  await expect(page.getByRole('option', { name: /Samsung Galaxy/ }).first()).toBeVisible();
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?.*q=Samsung/);
  await expect(page.getByRole('article').first()).toContainText('Samsung');

  // One letter dropped from "Samsung" (trigram match on product titles).
  await box.fill('Samsng');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?.*q=Samsng/);
  await expect(page.getByRole('article').first()).toContainText('Samsung');

  expect(errors).toEqual([]);
});
