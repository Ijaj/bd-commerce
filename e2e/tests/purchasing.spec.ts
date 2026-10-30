import { expect, type Page, test } from '@playwright/test';
import { createCategoryApi, createProductApi, uniqueName, watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';

test.use({ storageState: OWNER_STATE });

async function jsonOk<T>(res: import('@playwright/test').APIResponse): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} -> ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

async function onHand(page: Page, sku: string) {
  const inv = await jsonOk<{ items: { sku: string; onHand: number }[] }>(
    await page.request.get('/v1/admin/inventory', { params: { q: sku } }),
  );
  return inv.items.find((i) => i.sku === sku)?.onHand ?? 0;
}

test('purchasing: draft PO, send, partial receive, close short, supplier balance and payment', async ({
  page,
}) => {
  const errors = watchErrors(page);
  const supplier = await jsonOk<{ id: string; name: string }>(
    await page.request.post('/v1/admin/suppliers', {
      data: { name: uniqueName('E2E Supplier'), shipMode: 'via_warehouse' },
    }),
  );
  const category = await createCategoryApi(page, uniqueName('E2E PoCat'));
  const { sku } = await createProductApi(page, uniqueName('E2E PoItem'), category.id);
  expect(await onHand(page, sku)).toBe(0);

  // New PO from the supplier link: one line, qty 10 at 120.00.
  await page.goto(`/purchase-orders/new?supplierId=${supplier.id}`);
  await expect(page.getByRole('heading', { name: 'New purchase order' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Add line' }).fill(sku);
  await page.getByRole('option', { name: new RegExp(sku) }).click();
  await page.getByLabel(`Quantity ${sku}`).fill('10');
  await page.getByLabel(`Unit cost ${sku}`).fill('120');
  await expect(page.getByText('৳1,200', { exact: true }).first()).toBeVisible();

  // Sending persists the draft first, then sends; the page moves to the saved order.
  await page.getByRole('button', { name: 'Send to supplier' }).click();
  await page.waitForURL(/\/purchase-orders\/[0-9a-f-]{36}$/);
  const poId = page.url().split('/').pop() as string;
  await expect(page.getByRole('heading', { name: /^PO-/ })).toBeVisible();
  await expect(page.getByText('Sent', { exact: true }).first()).toBeVisible();
  // Sent: lines are locked.
  await expect(page.getByLabel(`Quantity ${sku}`)).toHaveCount(0);

  // Receive 6 good + 1 rejected.
  await page.getByRole('button', { name: 'Receive goods' }).click();
  const modal = page.getByRole('dialog', { name: /^Receive goods/ });
  await modal.getByLabel(`Good ${sku}`).fill('6');
  await modal.getByLabel(`Rejected ${sku}`).fill('1');
  await modal.getByLabel(/Receiving note/).fill('one box dented');
  await modal.getByRole('button', { name: /Confirm receipt/ }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText('Partially received', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('one box dented')).toBeVisible();
  expect(await onHand(page, sku)).toBe(6);

  // Close short: remaining 3 are dropped.
  await page.getByRole('button', { name: 'Close PO' }).first().click();
  const closeDlg = page.getByRole('dialog', { name: /short$/ });
  await closeDlg.getByLabel(/^Reason/).fill('supplier cannot deliver the rest');
  await closeDlg.getByRole('button', { name: 'Close PO' }).click();
  await expect(closeDlg).toBeHidden();
  await expect(page.getByText('Closed short', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/supplier cannot deliver the rest/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive goods' })).toHaveCount(0);

  // The list shows it under the "Closed short" tab.
  await page.goto('/purchase-orders');
  await page.getByRole('tab', { name: /Closed short/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(supplier.name) })).toBeVisible();

  // Supplier owes 6 x 120.00; a cash payment lowers the balance.
  const before = await jsonOk<{ balanceP: number; items: { type: string; amountP: number }[] }>(
    await page.request.get(`/v1/admin/suppliers/${supplier.id}/ledger`),
  );
  expect(before.balanceP).toBe(72000);
  expect(before.items.some((e) => e.type === 'receipt' && e.amountP === 72000)).toBe(true);
  await jsonOk(
    await page.request.post(`/v1/admin/suppliers/${supplier.id}/payments`, {
      data: { amountP: 30000, method: 'cash' },
    }),
  );
  const after = await jsonOk<{ balanceP: number }>(
    await page.request.get(`/v1/admin/suppliers/${supplier.id}/ledger`),
  );
  expect(after.balanceP).toBe(42000);

  // The printable PO opens without the app shell.
  await page.goto(`/print/po/${poId}`);
  await expect(page.getByText('PURCHASE ORDER')).toBeVisible();
  await expect(page.getByText(sku)).toBeVisible();
  expect(errors).toEqual([]);
});
