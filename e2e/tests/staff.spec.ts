import { expect, test } from '@playwright/test';
import { uniqueEmail } from '../support/accounts';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('create a staff member and see the temporary password once', async ({ page }) => {
  const email = uniqueEmail('staff');
  await page.goto('/staff');
  await expect(page.getByRole('heading', { name: 'Staff', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add staff' }).click();
  const modal = page.getByRole('dialog', { name: 'Add staff member' });
  await modal.getByLabel('Name').fill('E2E Staff');
  await modal.getByLabel('Email').fill(email);
  await modal.getByRole('button', { name: 'Create' }).click();

  const temp = page.getByRole('dialog', { name: 'Temporary password' });
  await expect(temp).toBeVisible();
  await expect(temp.locator('code')).toHaveText(/\S{8,}/);
  await temp.getByRole('button', { name: 'Done' }).click();
  await expect(temp).toBeHidden();

  await expect(page.getByRole('row', { name: new RegExp(email) })).toBeVisible();
});
