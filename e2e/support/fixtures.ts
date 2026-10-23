import type { Locator, Page } from '@playwright/test';

const IMGPROXY_ORIGIN = 'http://localhost:8080';

/** Smallest valid PNG (1x1), accepted by the media endpoint (sharp reads and re-encodes it). */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Feeds the PNG to the first Mantine dropzone file input inside `scope`. */
export async function uploadPng(scope: Locator, name = 'e2e.png') {
  await scope
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name, mimeType: 'image/png', buffer: PNG_1X1 });
}

export const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;

/**
 * Collects console errors, uncaught page errors and failed (>= 400) API/app responses; assert the
 * returned array is empty at the end of a flow. Image URLs point at imgproxy, which cannot read the
 * in-memory test storage, so its 404s are ignored.
 */
export function watchErrors(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // The browser's generic "Failed to load resource" line is covered by the response check.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource'))
      errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (
      res.status() >= 400 &&
      !res.url().startsWith(IMGPROXY_ORIGIN) &&
      !ignore.some((r) => r.test(res.url()))
    )
      errors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return errors;
}

/** Creates a main category through the API (uploads an image first) using the page's session. */
export async function createCategoryApi(page: Page, nameEn: string) {
  const media = await page.request.post('/v1/admin/media', {
    multipart: { file: { name: 'cat.png', mimeType: 'image/png', buffer: PNG_1X1 } },
  });
  if (!media.ok()) throw new Error(`media upload failed: ${media.status()} ${await media.text()}`);
  const { id: imageMediaId } = (await media.json()) as { id: string };
  const res = await page.request.post('/v1/admin/categories', {
    data: { nameEn, imageMediaId },
  });
  if (!res.ok()) throw new Error(`category create failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; nameEn: string; slug: string };
}

/** Creates a draft simple product (default variant, SKU auto-generated) through the API. */
export async function createProductApi(page: Page, titleEn: string, primaryCategoryId: string) {
  const res = await page.request.post('/v1/admin/products', {
    data: { titleEn, primaryCategoryId, options: [] },
  });
  if (!res.ok()) throw new Error(`product create failed: ${res.status()} ${await res.text()}`);
  const product = (await res.json()) as { id: string; variants: { id: string; sku: string }[] };
  const sku = product.variants[0]?.sku;
  if (!sku) throw new Error('product has no default variant');
  return { id: product.id, sku };
}
