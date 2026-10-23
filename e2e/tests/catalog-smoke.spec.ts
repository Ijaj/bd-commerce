import { expect, test } from '@playwright/test';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

const routes = [
  { path: '/catalog/products', heading: 'Products' },
  { path: '/catalog/categories', heading: 'Categories' },
  { path: '/catalog/brands', heading: 'Brands' },
  { path: '/catalog/inventory', heading: 'Inventory' },
  { path: '/catalog/import-export', heading: 'Import / Export' },
];

test.describe('catalog pages render', () => {
  for (const { path, heading } of routes) {
    test(`${path} shows "${heading}" without console errors`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
    });
  }
});
