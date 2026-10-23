import { expect, test } from '@playwright/test';
import { uniqueName, uploadPng, watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('category tree: create root with image, sub-category, select attribute, delete empty', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const root = uniqueName('E2E Root');
  const child = uniqueName('E2E Child');
  await page.goto('/catalog/categories');
  await expect(page.getByRole('heading', { name: 'Categories', exact: true })).toBeVisible();

  // Main category needs an image
  await page.getByRole('button', { name: 'Add main category' }).click();
  const drawer = page.getByRole('dialog', { name: 'New main category' });
  await drawer.getByLabel('Name (English)').fill(root);
  await drawer.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByText(/image/i).first()).toBeVisible(); // blocked without an image
  await uploadPng(drawer);
  await expect(drawer.locator('img').first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Create category' }).click();

  // After saving the drawer switches to edit mode
  await expect(page.getByRole('dialog', { name: root })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText(root, { exact: true })).toBeVisible();

  // Sub-category
  await page.getByRole('button', { name: `Actions for ${root}` }).click();
  await page.getByRole('menuitem', { name: 'Add sub-category' }).click();
  const sub = page.getByRole('dialog', { name: `New sub-category of ${root}` });
  await sub.getByLabel('Name (English)').fill(child);
  await sub.getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByRole('dialog', { name: child })).toBeVisible();

  // Select attribute with 2 options, through the option editor
  await page.getByRole('tab', { name: /Attributes/ }).click();
  await page.getByRole('button', { name: 'Add attribute' }).click();
  const attr = page.getByRole('dialog', { name: 'Add attribute' });
  await attr.getByLabel('Key').fill('finish');
  await attr.getByLabel('Name (English)').fill('Finish');
  await attr.getByLabel('Type').click();
  await page
    .getByRole('option', { name: /^Select/ })
    .first()
    .click();
  await attr
    .getByRole('button', { name: /^(Save|Create|Add)/ })
    .last()
    .click();
  await expect(page.getByText('Finish').first()).toBeVisible();

  await page.getByRole('button', { name: 'Options (0)' }).click();
  const editor = page.getByTestId('option-editor');
  await editor.getByRole('button', { name: 'Add option' }).click();
  await editor.getByLabel('Option (English)').nth(0).fill('Matte');
  await editor.getByRole('button', { name: 'Add option' }).click();
  await editor.getByLabel('Option (English)').nth(1).fill('Glossy');
  await editor.getByRole('button', { name: 'Save options' }).click();
  await expect(editor.getByText('Options (2)')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Save options' })).toBeDisabled();

  // Close drawers, delete the (empty) sub-category
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: `Actions for ${child}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const del = page.getByRole('dialog', { name: 'Delete category' });
  await expect(del.getByText('It has no sub-categories and no products.')).toBeVisible();
  await del.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: `Actions for ${child}` })).toHaveCount(0);
  expect(errors).toEqual([]);
});
