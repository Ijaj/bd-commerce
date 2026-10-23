import { expect, test } from '@playwright/test';
import { createCategoryApi, createProductApi, uniqueName, watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('inventory: adjust stock +10 with a note and see it in the history', async ({ page }) => {
  const errors = watchErrors(page);
  const category = await createCategoryApi(page, uniqueName('E2E InvCat'));
  const title = uniqueName('E2E Stocked');
  const { sku } = await createProductApi(page, title, category.id);
  const note = `e2e restock ${Date.now().toString(36)}`;

  await page.goto('/catalog/inventory');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await page.getByLabel('Search').fill(sku);
  const row = page.getByRole('row', { name: new RegExp(sku) });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Adjust' }).click();
  const modal = page.getByRole('dialog', { name: 'Adjust stock' });
  await modal.getByLabel(/^Change/).fill('10');
  await modal.getByLabel('Note').fill(note);
  await expect(modal.getByText('On hand: 0')).toContainText('10');
  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(modal).toBeHidden();
  await expect(row).toContainText('10');

  await row.getByRole('button', { name: 'History' }).click();
  const drawer = page.getByRole('dialog', { name: /Stock history/ });
  await expect(drawer.getByText(note)).toBeVisible();
  await expect(drawer.getByText('+10')).toBeVisible();
  expect(errors).toEqual([]);
});
