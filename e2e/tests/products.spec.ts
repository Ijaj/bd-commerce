import { expect, test } from '@playwright/test';
import { createCategoryApi, uniqueName, watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('product: create, 2 options (Color x Size) with prices, save, publish', async ({ page }) => {
  const errors = watchErrors(page);
  const category = await createCategoryApi(page, uniqueName('E2E ProdCat'));
  const title = uniqueName('E2E Shirt');

  await page.goto('/catalog/products');
  await page.getByRole('button', { name: 'New product' }).click();
  await page.getByLabel('Title (English)').fill(title);
  await page.getByRole('combobox', { name: 'Primary category' }).click();
  await page.getByRole('option', { name: new RegExp(category.nameEn) }).click();
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created')).toBeVisible();
  await expect(page).toHaveURL(/\/catalog\/products\/(?!new)[0-9a-f-]{36}/);

  await page.getByRole('tab', { name: /Variants/ }).click();
  await page.getByLabel('This product has options').check({ force: true });
  const editor = page.getByRole('tabpanel');
  await editor.getByLabel('Name (English)').first().fill('Color');
  const addValue = editor.getByRole('button', { name: 'Add value' });
  const values = editor.getByLabel(/^Value \d+ \(English\)$/);
  await addValue.first().click();
  await addValue.first().click();
  await values.nth(0).fill('Red');
  await values.nth(1).fill('Blue');
  await editor.getByRole('button', { name: 'Add option' }).click();
  await editor.getByLabel('Name (English)').nth(1).fill('Size');
  await addValue.nth(1).click();
  await addValue.nth(1).click();
  await values.nth(2).fill('M');
  await values.nth(3).fill('L');

  await expect(page.getByRole('tab', { name: 'Variants (4)' })).toBeVisible();
  const skus = page.getByLabel(/^SKU /);
  await expect(skus).toHaveCount(4);
  const tag = Date.now().toString(36).toUpperCase();
  const prices = page.getByLabel(/^Price /);
  for (let i = 0; i < 4; i++) {
    await skus.nth(i).fill(`E2E-${tag}-${i + 1}`);
    await prices.nth(i).fill(String(500 + i * 50));
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Product saved')).toBeVisible();

  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

  // The product list shows it as active with 4 variants
  await page.goto('/catalog/products');
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/active/i);
  expect(errors).toEqual([]);
});
