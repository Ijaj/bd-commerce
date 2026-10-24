import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';

test.use({ baseURL: SHOP_URL });

test('home: header, category menu and tiles, feed grows on scroll', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Search' })).toBeVisible();
  const tiles = page.getByRole('region', { name: 'Shop by category' });
  await expect(tiles.getByRole('link').first()).toBeVisible();

  const cards = page.getByRole('article');
  await expect(cards.first()).toBeVisible();
  const initial = await cards.count();
  expect(initial).toBeGreaterThan(0);

  // The feed loads the next page when its end scrolls into view; "Load more" is the fallback.
  await expect
    .poll(async () => {
      const more = page.getByRole('button', { name: 'Load more' });
      if (await more.isVisible()) await more.click();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      return cards.count();
    })
    .toBeGreaterThan(initial);

  expect(errors).toEqual([]);
});
