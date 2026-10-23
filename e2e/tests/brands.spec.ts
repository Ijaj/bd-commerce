import { expect, test } from '@playwright/test';
import { uniqueName, watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('create a brand and see it listed', async ({ page }) => {
  const errors = watchErrors(page);
  const name = uniqueName('E2E Brand');
  await page.goto('/catalog/brands');
  await page.getByRole('button', { name: 'Add brand' }).click();
  const modal = page.getByRole('dialog', { name: 'Add brand' });
  await modal.getByLabel('Name (English)').fill(name);
  await modal.getByRole('button', { name: 'Add brand' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  expect(errors).toEqual([]);
});
