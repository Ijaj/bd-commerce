import { expect, test } from '@playwright/test';
import { SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';

test.use({ baseURL: SHOP_URL });

/** Price of a product card: the first taka amount in the card (the struck-through old price follows it). */
async function cardPrices(page: import('@playwright/test').Page) {
  const texts = await page.getByRole('article').allInnerTexts();
  return texts.map((t) => {
    const m = /৳\s?([\d,]+)/.exec(t) ?? /Tk\s?([\d,]+)/.exec(t);
    if (!m?.[1]) throw new Error(`no price in card: ${t}`);
    return Number(m[1].replaceAll(',', ''));
  });
}

test('category: brand filter updates URL and results, sort by price ascending', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/c/electronics');
  await expect(page.getByRole('heading', { level: 1, name: 'Electronics' })).toBeVisible();
  const cards = page.getByRole('article');
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);

  await page.getByLabel(/^Samsung/).check();
  await expect(page).toHaveURL(/[?&]brand=samsung(&|$)/);
  await expect(page.getByRole('article').first()).toContainText('Samsung');
  const filtered = await cards.count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(total);
  for (const title of await cards
    .locator('a[title]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('title') ?? ''))) {
    expect(title).toContain('Samsung');
  }

  await page
    .getByRole('combobox', { name: 'Sort by' })
    .selectOption({ label: 'Price: low to high' });
  await expect(page).toHaveURL(/[?&]sort=price_asc/);
  await expect(page).toHaveURL(/[?&]brand=samsung/);
  const prices = await cardPrices(page);
  expect(prices.length).toBeGreaterThan(1);
  expect(prices[0]).toBeLessThanOrEqual(prices[1] ?? 0);

  expect(errors).toEqual([]);
});
