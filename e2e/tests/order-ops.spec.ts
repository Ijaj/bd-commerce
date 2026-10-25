// biome-ignore-all lint/suspicious/noExplicitAny: e2e reads loosely-typed admin API JSON
import { type APIRequestContext, expect, test } from '@playwright/test';
import { ADMIN_URL, API_URL, SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';
import { signupShopCustomer, uniquePhone } from '../support/shop';
import { addToCart, expectQuote, pickDhakaArea, placeOrder, WIPES } from '../support/storefront';

test.use({ baseURL: SHOP_URL });

async function ownerApi(playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright']) {
  return playwright.request.newContext({ baseURL: ADMIN_URL, storageState: OWNER_STATE });
}

async function json<T = any>(res: import('@playwright/test').APIResponse): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} -> ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Books + hands over + delivers every item of the order through the fake courier; returns the shipment. */
async function deliverOrder(admin: APIRequestContext, orderNo: string) {
  const order = await json(await admin.get(`/v1/admin/orders/${orderNo}`));
  const shipment = await json(
    await admin.post(`/v1/admin/orders/${order.id}/shipments`, {
      data: { items: order.items.map((i: any) => ({ orderItemId: i.id, qty: i.qty })) },
    }),
  );
  const booked = await json(
    await admin.post(`/v1/admin/shipments/${shipment.id}/book`, { data: { courierCode: 'fake' } }),
  );
  await json(await admin.post(`/v1/admin/shipments/${shipment.id}/handover`, { data: {} }));
  const detail = await json(await admin.get(`/v1/admin/shipments/${shipment.id}`));
  const consignmentId = detail.consignmentId ?? booked.consignmentId ?? `FAKE-${detail.shipmentNo}`;
  const hook = await fetch(`${API_URL}/v1/public/courier-webhooks/fake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fake-courier': 'e2e' },
    body: JSON.stringify({ consignmentId, status: 'delivered' }),
  });
  expect(hook.ok).toBeTruthy();
  return { order, shipment };
}

test('guest order lands in the call queue; staff confirms it from the admin UI', async ({
  page,
  browser,
}) => {
  const errors = watchErrors(page);
  const phone = uniquePhone();
  await addToCart(page, WIPES.slug);
  await page.goto('/checkout');
  await page.getByLabel('Full name', { exact: true }).fill('Rafiq Ahmed');
  await page.getByLabel('Mobile number', { exact: true }).fill(phone);
  await pickDhakaArea(page);
  await page.getByLabel('Address', { exact: true }).fill('House 9, Road 2');
  await expectQuote(page);
  const orderNo = await placeOrder(page);

  const ctx = await browser.newContext({ baseURL: ADMIN_URL, storageState: OWNER_STATE });
  const admin = await ctx.newPage();
  await admin.goto('/call-queue');
  const card = admin
    .locator('div')
    .filter({ hasText: orderNo })
    .filter({ has: admin.getByRole('button', { name: 'Confirmed' }) })
    .last();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Confirmed' }).click();
  await admin.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(admin.getByRole('link', { name: orderNo })).toBeHidden();

  await admin.goto('/orders');
  await expect(admin.getByRole('link', { name: orderNo })).toBeVisible();
  await ctx.close();
  expect(errors).toEqual([]);
});

test('ship with the fake courier, deliver, invoice, return, refund', async ({
  page,
  browser,
  playwright,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const customer = { name: 'Nusrat Jahan', phone: uniquePhone(), password: 'secret-pass-9' };
  await signupShopCustomer(page, customer);
  await addToCart(page, WIPES.slug);
  await page.goto('/checkout');
  await pickDhakaArea(page);
  await page.getByLabel('Address', { exact: true }).fill('Flat 2A, Road 11');
  await expectQuote(page);
  const orderNo = await placeOrder(page);

  const api = await ownerApi(playwright);
  const { order } = await deliverOrder(api, orderNo);
  const delivered = await json(await api.get(`/v1/admin/orders/${order.id}`));
  expect(delivered.status).toBe('delivered');

  // Admin UI: detail page + invoice print view.
  const ctx = await browser.newContext({ baseURL: ADMIN_URL, storageState: OWNER_STATE });
  const admin = await ctx.newPage();
  await admin.goto(`/orders/${order.id}`);
  await expect(admin.getByRole('heading', { name: orderNo })).toBeVisible();
  // Shipping may already have issued the invoice; otherwise issue it from the order page.
  const listInvoices = async () => {
    const res = await json<any>(await api.get(`/v1/admin/orders/${order.id}/invoices`));
    return Array.isArray(res) ? res : (res.items ?? []);
  };
  if ((await listInvoices()).length === 0) {
    await admin.getByRole('button', { name: /Issue invoice/ }).click();
  }
  await expect(admin.getByRole('link', { name: /Print/ }).first()).toBeVisible();
  const inv = await listInvoices();
  await admin.goto(`/print/invoice/${inv[0].id}`);
  await expect(admin.getByText(orderNo).first()).toBeVisible();

  // Shop: invoice + return request.
  await page.goto(`/order/${orderNo}/invoice`);
  await expect(page.getByText(orderNo).first()).toBeVisible();
  await page.goto(`/account/returns/new?order=${orderNo}`);
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Submit|Request/i }).click();
  await expect(page).toHaveURL(/\/account\/returns\/RET-/);
  const returnNo = /\/account\/returns\/(RET-[^/?#]+)/.exec(page.url())?.[1] ?? '';

  // Staff: approve, receive, inspect, refund; the admin lists show them.
  const list = await json(await api.get(`/v1/admin/returns?q=${returnNo}`));
  const ret = (list.items ?? list.rows)[0];
  await json(await api.post(`/v1/admin/returns/${ret.id}/approve`, { data: { fault: 'ours' } }));
  await json(await api.post(`/v1/admin/returns/${ret.id}/receive`, { data: {} }));
  const full = await json(await api.get(`/v1/admin/returns/${ret.id}`));
  await json(
    await api.post(`/v1/admin/returns/${ret.id}/inspect`, {
      data: {
        items: full.items.map((i: any) => ({
          returnItemId: i.id,
          condition: 'resellable',
          restock: true,
        })),
      },
    }),
  );
  await admin.goto(`/returns/${ret.id}`);
  await admin.getByRole('button', { name: /Create refund/ }).click();
  await admin
    .getByRole('button', { name: /^(Create|Save|Submit)/ })
    .last()
    .click();
  await admin.goto('/refunds');
  await expect(admin.getByText(orderNo).first()).toBeVisible();
  await ctx.close();
  expect(errors).toEqual([]);
});
