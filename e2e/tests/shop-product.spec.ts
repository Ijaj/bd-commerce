import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';

test.use({ baseURL: SHOP_URL });

test('product: title, price, variant switch and recently viewed after two products', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/p/demo-aarong-classic-panjabi');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aarong Classic Panjabi' }),
  ).toBeVisible();
  await expect(page.getByText(/2,800/).first()).toBeVisible();

  const colour = page.getByRole('radiogroup', { name: /Colou?r/ });
  await expect(colour.getByRole('radio')).toHaveCount(3);
  const maroon = colour.getByRole('radio', { name: 'Maroon' });
  await maroon.click();
  await expect(maroon).toHaveAttribute('aria-checked', 'true');

  await page.goto('/p/demo-yellow-linen-panjabi');
  await expect(page.getByRole('heading', { level: 1, name: 'Yellow Linen Panjabi' })).toBeVisible();
  const recent = page.getByRole('region', { name: 'Recently viewed' });
  await expect(recent).toBeVisible();
  await expect(recent.getByRole('link', { name: 'Aarong Classic Panjabi' }).first()).toBeVisible();

  expect(errors).toEqual([]);
});
