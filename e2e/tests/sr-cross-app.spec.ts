import { randomBytes } from 'node:crypto';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { loginAndSetup2fa, uniqueEmail } from '../support/accounts';
import { ADMIN_URL, PORTAL_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';
import { uniquePhone } from '../support/shop';
import { WIPES } from '../support/storefront';

interface Created {
  id: string;
  name: string;
  email: string;
  tempPassword: string;
}

async function createRole(api: APIRequestContext, name: string, permissions: string[]) {
  const res = await api.post('/v1/admin/roles', { data: { name, permissions } });
  if (!res.ok()) throw new Error(`role create failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string };
}

async function createStaff(api: APIRequestContext, name: string, email: string, roleId: string) {
  const res = await api.post('/v1/admin/staff', { data: { name, email, roleIds: [roleId] } });
  if (!res.ok()) throw new Error(`staff create failed: ${res.status()} ${await res.text()}`);
  const { staff, tempPassword } = (await res.json()) as {
    staff: { id: string };
    tempPassword: string;
  };
  return { id: staff.id, name, email, tempPassword } satisfies Created;
}

test('SR sale across apps: portal submits, admin approves, the memo link opens', async ({
  browser,
  playwright,
}) => {
  const suffix = randomBytes(3).toString('hex');
  const shopName = `E2E Shop ${suffix}`;

  // Owner sets up one sales rep (portal only) and one approver (admin, cannot approve own sales).
  const owner = await playwright.request.newContext({
    baseURL: ADMIN_URL,
    storageState: OWNER_STATE,
  });
  const repRole = await createRole(owner, `E2E Rep ${suffix}`, ['sr.portal']);
  const approverRole = await createRole(owner, `E2E Approver ${suffix}`, [
    'b2b.view',
    'sr.approve',
  ]);
  const rep = await createStaff(owner, `E2E Rep ${suffix}`, uniqueEmail('rep'), repRole.id);
  const approver = await createStaff(
    owner,
    `E2E Approver ${suffix}`,
    uniqueEmail('approver'),
    approverRole.id,
  );
  const profile = await owner.put(`/v1/admin/sr/profiles/${rep.id}`, {
    data: { area: 'Dhanmondi', commissionBp: 200 },
  });
  expect(profile.ok()).toBeTruthy();
  await owner.dispose();

  // Sales rep in the portal: first login sets up 2FA, then adds a shop and a sale with 0 paid now.
  const portalCtx = await browser.newContext({ baseURL: PORTAL_URL });
  const portal = await portalCtx.newPage();
  const errors = watchErrors(portal);
  await loginAndSetup2fa(
    portal,
    { email: rep.email, name: rep.name, password: rep.tempPassword },
    /Hello/,
  );

  await portal.goto('/sr/shops/new');
  // Required fields carry a " *" suffix in their labels.
  await portal.getByLabel(/^Shop name/).fill(shopName);
  await portal.getByLabel(/^Owner name/).fill('Owner Rahman');
  await portal.getByLabel(/^Phone/).fill(uniquePhone());
  await portal.getByLabel(/^Address/).fill('Shop 3, New Market');
  await portal.getByLabel(/^Area/).fill('Dhanmondi');
  await portal.getByRole('button', { name: 'Save shop' }).click();
  await expect(portal.getByText('Shop added')).toBeVisible();

  await portal.goto('/sr/new-sale');
  await portal.getByPlaceholder('Search my shops (name, owner, area)').fill(shopName);
  await portal.getByRole('button', { name: new RegExp(shopName) }).click();
  await portal.getByRole('button', { name: 'Add item' }).click();
  await portal.getByPlaceholder('Search product (name or SKU)').fill(WIPES.title);
  await portal
    .getByRole('button', { name: new RegExp(WIPES.title) })
    .first()
    .click();
  await portal.getByLabel('Amount collected now (৳)').fill('0');
  await portal.getByRole('button', { name: 'Review', exact: true }).click();

  const submitted = portal.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/v1\/portal\/sr\/sales$/.test(r.url()),
  );
  await portal.getByRole('button', { name: 'Submit for approval' }).click();
  const sale = await submitted;
  expect(sale.ok()).toBeTruthy();
  const { id: saleId, memoNo } = (await sale.json()) as { id: string; memoNo: string };
  await expect(portal.getByText('Sale submitted')).toBeVisible();

  // Admin approver approves the sale from the B2B sales queue.
  const adminCtx = await browser.newContext({ baseURL: ADMIN_URL });
  const admin = await adminCtx.newPage();
  const adminErrors = watchErrors(admin);
  await loginAndSetup2fa(admin, {
    email: approver.email,
    name: approver.name,
    password: approver.tempPassword,
  });
  await admin.goto(`/b2b/sales?open=${saleId}`);
  await expect(admin.getByText(memoNo).first()).toBeVisible();
  await admin.getByRole('button', { name: 'Approve', exact: true }).click();
  const approved = admin.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes(`/sr/sales/${saleId}/approve`),
  );
  await admin
    .getByRole('dialog', { name: 'Approve sale' })
    .getByRole('button', { name: 'Approve', exact: true })
    .click();
  expect((await approved).ok()).toBeTruthy();

  // Back in the portal: approved, with the memo share link.
  await portal.goto(`/sr/sales/${saleId}`);
  await expect(portal.getByText('Approved, awaiting delivery')).toBeVisible();
  const link = portal.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes(`/sales/${saleId}/memo-link`),
  );
  await portal.getByRole('button', { name: 'Share memo' }).click();
  const { url } = (await (await link).json()) as { url: string };

  // The public memo opens without a login.
  const publicCtx = await browser.newContext();
  const memo = await publicCtx.newPage();
  await memo.goto(url);
  await expect(memo.getByText(memoNo).first()).toBeVisible();
  await publicCtx.close();

  expect(errors).toEqual([]);
  expect(adminErrors).toEqual([]);
});
