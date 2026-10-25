import { expect, test } from '@playwright/test';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

test('maintenance mode toggle persists across reload', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const card = page.locator('[data-setting="maintenance_mode"]');
  const toggle = card.getByRole('switch', { name: 'Enabled' });
  await expect(toggle).not.toBeChecked();

  try {
    await toggle.check({ force: true });
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('maintenance_mode saved')).toBeVisible();

    await page.reload();
    await expect(
      page.locator('[data-setting="maintenance_mode"]').getByRole('switch', { name: 'Enabled' }),
    ).toBeChecked();

    // Public site status reflects it; admin keeps working while it is on.
    const site = await page.request.get('/v1/public/site');
    expect(site.ok()).toBe(true);
    expect(JSON.stringify(await site.json())).toContain('"enabled":true');
  } finally {
    // Leave the shared database clean for the other specs.
    const res = await page.request.delete('/v1/admin/settings/maintenance_mode');
    expect(res.ok()).toBe(true);
  }
});
