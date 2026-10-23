import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createCategoryApi, uniqueName, watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('import/export: download CSV template, check a small CSV, import it', async ({ page }) => {
  const errors = watchErrors(page);
  const category = await createCategoryApi(page, uniqueName('E2E ImpCat'));
  const tag = Date.now().toString(36);
  const slug = `e2e-import-${tag}`;

  await page.goto('/catalog/import-export');
  await expect(page.getByRole('heading', { name: 'Import / Export', exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Template CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/import-template.*\.csv$/);
  const template = readFileSync((await download.path()) as string, 'utf8');
  expect(template).toContain('product_slug');
  expect(template).toContain('sku');

  const csv = [
    'product_slug,title_en,primary_category_slug,option1_name_en,option1_value_en,sku,price,on_hand',
    `${slug},E2E Imported ${tag},${category.slug},Color,Red,IMP-${tag}-1,450.00,20`,
    `${slug},E2E Imported ${tag},${category.slug},Color,Blue,IMP-${tag}-2,450.00,10`,
  ].join('\n');
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('products.csv')).toBeVisible();

  await page.getByRole('button', { name: '1. Check file' }).click();
  const checked = page.getByRole('alert').filter({ hasText: 'File checked' });
  await expect(checked).toBeVisible();
  await expect(checked).toContainText('2 rows read');

  await page.getByRole('button', { name: '2. Import' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Import complete' })).toBeVisible();

  const list = await page.request.get(`/v1/admin/products?q=${slug}`);
  expect(list.ok()).toBe(true);
  const body = (await list.json()) as { items: { slug: string; variantCount: number }[] };
  expect(body.items.find((p) => p.slug === slug)?.variantCount).toBe(2);
  expect(errors).toEqual([]);
});
