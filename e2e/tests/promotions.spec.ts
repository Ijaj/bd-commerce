// biome-ignore-all lint/suspicious/noExplicitAny: e2e reads loosely-typed admin API JSON
import { expect, test } from '@playwright/test';
import { ADMIN_URL, API_URL, SHOP_URL } from '../support/env';
import { watchErrors } from '../support/fixtures';
import { OWNER_STATE } from '../support/global-setup';
import { uniquePhone } from '../support/shop';
import { addToCart, expectQuote, pickDhakaArea, placeOrder, WIPES } from '../support/storefront';

test.use({ baseURL: SHOP_URL });

async function json<T = any>(res: import('@playwright/test').APIResponse): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} -> ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

async function pub(path: string) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as any;
}

async function fillGuestCheckout(page: import('@playwright/test').Page) {
  await page.goto('/checkout');
  await page.getByLabel('Full name', { exact: true }).fill('Promo Buyer');
  await page.getByLabel('Mobile number', { exact: true }).fill(uniquePhone());
  await pickDhakaArea(page);
  await page.getByLabel('Address', { exact: true }).fill('House 3, Road 7');
  await expectQuote(page);
}

test('a code coupon discounts the order and cancelling gives the use back', async ({
  page,
  playwright,
}) => {
  const errors = watchErrors(page);
  const admin = await playwright.request.newContext({
    baseURL: ADMIN_URL,
    storageState: OWNER_STATE,
  });
  const code = `E2E${Date.now().toString(36).toUpperCase()}`;
  const created = await json(
    await admin.post('/v1/admin/coupons', {
      data: { name: 'E2E ten percent', kind: 'code', code, type: 'percent', value: 1000 },
    }),
  );
  await json(await admin.post(`/v1/admin/coupons/${created.id}/activate`));

  await addToCart(page, WIPES.slug);
  await page.goto('/cart');
  await page.getByRole('textbox', { name: 'Coupon code' }).fill(code);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText(code).first()).toBeVisible();

  await fillGuestCheckout(page);
  const orderNo = await placeOrder(page);

  const order = await json(await admin.get(`/v1/admin/orders/${orderNo}`));
  expect(order.money.couponDiscountP).toBeGreaterThan(0);
  expect(order.discounts[0].code).toBe(code);
  let detail = await json(await admin.get(`/v1/admin/coupons/${created.id}`));
  expect(detail.usesCount).toBe(1);

  await json(await admin.post(`/v1/admin/orders/${order.id}/cancel`, { data: { reason: 'e2e' } }));
  detail = await json(await admin.get(`/v1/admin/coupons/${created.id}`));
  expect(detail.usesCount).toBe(0);

  await json(await admin.post(`/v1/admin/coupons/${created.id}/pause`));
  await admin.dispose();
  expect(errors).toEqual([]);
});

test('a flash sale caps the quantity, shows on the product page, and cancelling restores stock', async ({
  page,
  playwright,
}) => {
  const errors = watchErrors(page);
  const admin = await playwright.request.newContext({
    baseURL: ADMIN_URL,
    storageState: OWNER_STATE,
  });
  const product = await pub(`/v1/public/products/${WIPES.slug}`);
  const variant = product.variants[0];
  const now = Date.now();
  const sale = await json(
    await admin.post('/v1/admin/flash-sales', {
      data: {
        nameEn: 'E2E flash',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 3_600_000).toISOString(),
        isActive: true,
      },
    }),
  );
  await json(
    await admin.put(`/v1/admin/flash-sales/${sale.id}/items`, {
      data: {
        items: [
          {
            variantId: variant.id,
            flashPriceP: Math.max(100, variant.priceP - 1000),
            qtyLimit: 2,
            perCustomerLimit: null,
          },
        ],
      },
    }),
  );

  try {
    // The product page is ISR (up to 60 s stale), so check the API the page renders from.
    const live = await pub(`/v1/public/products/${WIPES.slug}`);
    expect(live.variants[0].flash.remaining).toBe(2);

    await addToCart(page, WIPES.slug);
    await fillGuestCheckout(page);
    const orderNo = await placeOrder(page);
    const order = await json(await admin.get(`/v1/admin/orders/${orderNo}`));
    expect(order.items[0].priceSource).toBe('flash');

    const remaining = async () =>
      (await pub('/v1/public/flash-sales')).live[0]?.items[0]?.remaining;
    expect(await remaining()).toBe(1);

    await json(
      await admin.post(`/v1/admin/orders/${order.id}/cancel`, { data: { reason: 'e2e' } }),
    );
    expect(await remaining()).toBe(2);
  } finally {
    await admin.patch(`/v1/admin/flash-sales/${sale.id}`, { data: { isActive: false } });
    await admin.dispose();
  }
  expect(errors).toEqual([]);
});
