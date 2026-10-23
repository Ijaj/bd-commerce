import { expect, test } from '@playwright/test';
import {
  createOwnerViaCli,
  loginAndSetup2fa,
  loginWith2fa,
  submitLogin,
  uniqueEmail,
} from '../support/accounts';

test.describe('staff auth', () => {
  test('wrong password shows an error and stays on login', async ({ page }) => {
    const owner = createOwnerViaCli(uniqueEmail('wrongpw'), 'Wrong Pw');
    await submitLogin(page, owner.email, 'not-the-password');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with 2FA setup, logout, then re-login with a verify code', async ({ page }) => {
    const owner = createOwnerViaCli(uniqueEmail('auth'), 'Auth Owner');
    const account = await loginAndSetup2fa(page, owner);
    expect(account.backupCodes).toHaveLength(10);

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Protected pages bounce back to login when signed out.
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);

    await loginWith2fa(page, account);
    await expect(page.getByRole('button', { name: 'Account menu' })).toContainText('Auth Owner');
  });

  test('a backup code signs in once', async ({ page, context }) => {
    const owner = createOwnerViaCli(uniqueEmail('backup'), 'Backup Owner');
    const account = await loginAndSetup2fa(page, owner);
    const [code] = account.backupCodes ?? [];
    if (!code) throw new Error('no backup code');
    await context.clearCookies();

    await submitLogin(page, account.email, account.password);
    await page.getByRole('button', { name: 'Use a backup code instead' }).click();
    await page.getByLabel('Backup code').fill(code);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await context.clearCookies();
    await submitLogin(page, account.email, account.password);
    await page.getByRole('button', { name: 'Use a backup code instead' }).click();
    await page.getByLabel('Backup code').fill(code);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
