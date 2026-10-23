import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PermissionKey } from '../src/auth/permissions';
import { parseCsv } from '../src/catalog/import-export/file-io';
import { formatPaisa, parsePrice } from '../src/catalog/import-export/parse';
import { PrismaService } from '../src/prisma/prisma.service';
import { type Agent, createApp, createOwner, createStaffWith, resetDb } from './helpers';

const P = '/v1/admin/products';
type R = Record<string, string>;

const binary = (res: NodeJS.ReadableStream, cb: (e: Error | null, b: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

const csvOf = (rows: R[]) => {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const q = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const text = [headers.join(','), ...rows.map((r) => headers.map((h) => q(r[h] ?? '')).join(','))];
  return Buffer.from(text.join('\n'), 'utf8');
};

async function xlsxOf(rows: R[]) {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Products');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ''));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('import/export', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let catId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(app);
    owner = (await createOwner(app)).agent;
    const id = randomUUID();
    const cat = await prisma.category.create({
      data: { id, level: 1, path: `/${id}/`, nameEn: 'Toys', slug: 'toys' },
    });
    catId = cat.id;
    await prisma.category.create({
      data: {
        id: randomUUID(),
        level: 1,
        path: `/${randomUUID()}/`,
        nameEn: 'Books',
        slug: 'books',
      },
    });
    await prisma.brand.create({ data: { nameEn: 'Acme', slug: 'acme' } });
    await prisma.categoryAttribute.create({
      data: {
        categoryId: catId,
        key: 'material',
        nameEn: 'Material',
        type: 'select',
        options: { create: [{ valueEn: 'Cotton' }, { valueEn: 'Wool' }] },
      },
    });
    await prisma.categoryAttribute.create({
      data: {
        categoryId: catId,
        key: 'tags',
        nameEn: 'Tags',
        type: 'multiselect',
        options: { create: [{ valueEn: 'Soft' }, { valueEn: 'Big' }, { valueEn: 'Gift' }] },
      },
    });
  });
  afterAll(() => app.close());

  const baseRows = (): R[] => [
    {
      product_slug: 'teddy',
      title_en: 'Teddy Bear',
      title_bn: 'টেডি বিয়ার',
      status: 'draft',
      brand_slug: 'acme',
      primary_category_slug: 'toys',
      category_slugs: 'books',
      fulfillment: 'stock',
      description_html_en: '<p>Soft &amp; <b>cuddly</b></p>',
      weight_g: '300',
      is_preorder: 'false',
      is_upcoming: 'false',
      option1_name_en: 'Color',
      option1_name_bn: 'রঙ',
      option1_value_en: 'Red',
      option1_value_bn: 'লাল',
      sku: 'TB-RED',
      price: '1,250.50',
      compare_at_price: '1500',
      variant_active: 'true',
      on_hand: '10',
      low_stock_threshold: '3',
      'attr:material': 'Cotton',
      'attr:tags': 'Soft|Gift',
    },
    {
      product_slug: 'teddy',
      option1_name_en: 'Color',
      option1_value_en: 'Blue',
      option1_value_bn: 'নীল',
      sku: 'TB-BLUE',
      price: '1250.5',
      on_hand: '4',
    },
    {
      product_slug: 'ball',
      title_en: 'Ball',
      primary_category_slug: 'toys',
      sku: 'BALL-1',
      price: '99',
    },
  ];

  const importFile = (agent: Agent, buf: Buffer, name = 'f.csv', query = '') =>
    agent.post(`${P}/import${query}`).attach('file', buf, name);
  const previewFile = (agent: Agent, buf: Buffer, name = 'f.csv', query = '') =>
    agent.post(`${P}/import/preview${query}`).attach('file', buf, name);
  const download = (agent: Agent, path: string) =>
    agent
      .get(path)
      .buffer(true)
      .parse(binary as never);

  describe('price parsing', () => {
    it('parses taka text to paisa without floats', () => {
      expect(parsePrice('1,250.50')).toEqual({ ok: true, value: 125050 });
      expect(parsePrice('1250')).toEqual({ ok: true, value: 125000 });
      expect(parsePrice('0.5')).toEqual({ ok: true, value: 50 });
      expect(parsePrice('19.99')).toEqual({ ok: true, value: 1999 });
      expect(parsePrice('৳500').ok).toBe(false);
      expect(parsePrice('Tk 500').ok).toBe(false);
      expect(parsePrice('12.345').ok).toBe(false);
      expect(parsePrice('1,25,000').ok).toBe(false);
      expect(parsePrice('-5').ok).toBe(false);
      expect(formatPaisa(125050)).toBe('1250.50');
      expect(formatPaisa(5)).toBe('0.05');
    });
  });

  it('imports CSV, then export -> import is a no-op (csv and xlsx)', async () => {
    const res = await importFile(owner, csvOf(baseRows())).expect(200);
    expect(res.body.products).toEqual({ create: 2, update: 0, unchanged: 0 });
    expect(res.body.variants).toEqual({ create: 3, update: 0, unchanged: 0 });
    expect(res.body.stockMovements).toBe(2);

    const teddy = await prisma.product.findUniqueOrThrow({
      where: { slug: 'teddy' },
      include: { variants: { include: { inventory: true } }, categories: true },
    });
    expect(teddy.hasVariants).toBe(true);
    expect(teddy.descriptionHtmlEn).toContain('cuddly');
    expect(teddy.categories).toHaveLength(2);
    expect(teddy.variants.map((v) => v.priceP).sort()).toEqual([125050, 125050]);
    expect(teddy.variants.find((v) => v.sku === 'TB-RED')?.inventory?.onHand).toBe(10);

    for (const format of ['csv', 'xlsx'] as const) {
      const exp = await download(owner, `${P}/export?format=${format}`).expect(200);
      expect(exp.headers['content-disposition']).toMatch(/attachment; filename="products-.*\.\w+"/);
      const again = await previewFile(owner, exp.body as Buffer, `x.${format}`).expect(200);
      expect(again.body.errors).toEqual([]);
      expect(again.body.products).toEqual({ create: 0, update: 0, unchanged: 2 });
      expect(again.body.variants).toEqual({ create: 0, update: 0, unchanged: 3 });
      expect(again.body.stockMovements).toBe(0);
      const applied = await importFile(owner, exp.body as Buffer, `x.${format}`).expect(200);
      expect(applied.body.products.unchanged).toBe(2);
    }
    expect(await prisma.stockMovement.count()).toBe(2);
  });

  it('exports CSV as UTF-8 with BOM and Bangla intact', async () => {
    await importFile(owner, csvOf(baseRows())).expect(200);
    const exp = await download(owner, `${P}/export?format=csv`).expect(200);
    const buf = exp.body as Buffer;
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(exp.headers['content-type']).toContain('text/csv');
    const records = parseCsv(buf.toString('utf8'));
    const head = records[0] ?? [];
    expect(head.slice(0, 3)).toEqual(['product_slug', 'title_en', 'title_bn']);
    expect(head).toContain('attr:material');
    expect(records.flat()).toContain('টেডি বিয়ার');
    expect(records).toHaveLength(4);
    const price = head.indexOf('price');
    expect(records[1]?.[price]).toBe('1250.50');
  });

  it('reads an XLSX upload', async () => {
    const res = await importFile(owner, await xlsxOf(baseRows()), 'p.xlsx').expect(200);
    expect(res.body.products.create).toBe(2);
    const exp = await download(owner, `${P}/export?format=xlsx`).expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exp.body as Buffer);
    const ws = wb.worksheets[0];
    expect(ws?.rowCount).toBe(4);
    expect(ws?.getRow(1).getCell(1).value).toBe('product_slug');
  });

  it('filters the export like the product list', async () => {
    await importFile(owner, csvOf(baseRows())).expect(200);
    const exp = await download(owner, `${P}/export?format=csv&q=ball`).expect(200);
    expect(parseCsv((exp.body as Buffer).toString('utf8'))).toHaveLength(2);
  });

  it('reports row/column errors and writes nothing', async () => {
    const rows: R[] = [
      { product_slug: 'a', title_en: 'A', primary_category_slug: 'nope', sku: 'S1', price: '10' },
      { product_slug: 'b', title_en: 'B', primary_category_slug: 'toys', sku: 'S1', price: '10' },
      { product_slug: 'c', title_en: 'C', primary_category_slug: 'toys', sku: 'S3', price: '৳50' },
      {
        product_slug: 'd',
        title_en: 'D',
        primary_category_slug: 'toys',
        sku: 'S4',
        price: '10',
        option1_name_en: 'Color',
        option1_value_en: 'Red',
      },
      {
        product_slug: 'd',
        sku: 'S5',
        price: '10',
        option1_name_en: 'Size',
        option1_value_en: 'L',
      },
      {
        product_slug: 'e',
        title_en: 'E',
        primary_category_slug: 'toys',
        sku: 'S6',
        price: '10',
        'attr:material': 'Silk',
      },
    ];
    const res = await importFile(owner, csvOf(rows)).expect(400);
    const errs = res.body.errors as { row: number; column: string; message: string }[];
    const has = (row: number, column: string) =>
      errs.some((e) => e.row === row && e.column === column);
    expect(has(2, 'primary_category_slug')).toBe(true);
    expect(has(3, 'sku')).toBe(true);
    expect(has(4, 'price')).toBe(true);
    expect(has(6, 'option1_name_en')).toBe(true);
    expect(has(7, 'attr:material')).toBe(true);
    expect(await prisma.product.count()).toBe(0);

    const preview = await previewFile(owner, csvOf(rows)).expect(200);
    expect(preview.body.errorCount).toBe(errs.length);
  });

  it('rejects duplicate option combinations and missing required headers', async () => {
    const dup: R[] = [
      {
        product_slug: 'd',
        title_en: 'D',
        primary_category_slug: 'toys',
        sku: 'S4',
        price: '10',
        option1_name_en: 'Color',
        option1_value_en: 'Red',
      },
      {
        product_slug: 'd',
        sku: 'S5',
        price: '10',
        option1_name_en: 'Color',
        option1_value_en: 'red',
      },
    ];
    const res = await importFile(owner, csvOf(dup)).expect(400);
    expect(res.body.errors[0]).toMatchObject({ row: 3, column: 'option1_value_en' });
    const noSku = await importFile(owner, csvOf([{ product_slug: 'x', price: '1' }])).expect(400);
    expect(noSku.body.errors[0]).toMatchObject({ row: 1, column: 'sku' });
  });

  it('upserts: updates price and stock (ledger row with reason import)', async () => {
    await importFile(owner, csvOf(baseRows())).expect(200);
    const rows = baseRows();
    (rows[0] as R).price = '1300';
    (rows[0] as R).compare_at_price = '1500';
    (rows[0] as R).on_hand = '25';
    (rows[1] as R).on_hand = '4';
    const res = await importFile(owner, csvOf(rows)).expect(200);
    expect(res.body.products).toEqual({ create: 0, update: 1, unchanged: 1 });
    expect(res.body.variants).toEqual({ create: 0, update: 1, unchanged: 2 });
    expect(res.body.stockMovements).toBe(1);

    const v = await prisma.variant.findUniqueOrThrow({
      where: { sku: 'TB-RED' },
      include: { inventory: true },
    });
    expect(v.priceP).toBe(130000);
    expect(v.inventory?.onHand).toBe(25);
    const moves = await prisma.stockMovement.findMany({
      where: { variantId: v.id },
      orderBy: { at: 'asc' },
    });
    expect(moves.map((m) => [m.qtyDelta, m.reason, m.note])).toEqual([
      [10, 'import', 'bulk import'],
      [15, 'import', 'bulk import'],
    ]);
    expect(moves[1]?.staffId).toBeTruthy();
  });

  it('adds a new variant to an existing product and honours create_only', async () => {
    await importFile(owner, csvOf(baseRows())).expect(200);
    const rows = baseRows();
    rows.splice(2, 0, {
      product_slug: 'teddy',
      option1_name_en: 'Color',
      option1_value_en: 'Green',
      sku: 'TB-GREEN',
      price: '1250.50',
    });
    const res = await importFile(owner, csvOf(rows)).expect(200);
    expect(res.body.variants).toMatchObject({ create: 1, unchanged: 3 });
    expect(await prisma.variant.count({ where: { product: { slug: 'teddy' } } })).toBe(3);

    const co = await previewFile(owner, csvOf(rows), 'f.csv', '?mode=create_only').expect(200);
    expect(co.body.errors.map((e: { column: string }) => e.column)).toContain('product_slug');
  });

  it('enforces permissions', async () => {
    await importFile(owner, csvOf(baseRows())).expect(200);
    await prisma.variant.update({ where: { sku: 'TB-RED' }, data: { costP: 500 } });

    const none = (await createStaffWith(app, ['products.view'])).agent;
    await importFile(none, csvOf(baseRows())).expect(403);
    await previewFile(none, csvOf(baseRows())).expect(403);
    await download(none, `${P}/import-template`).expect(403);
    await download(none, `${P}/export`).expect(403);

    const exporter = (await createStaffWith(app, ['products.export'])).agent;
    const exp = await download(exporter, `${P}/export?format=csv`).expect(200);
    const head = parseCsv((exp.body as Buffer).toString('utf8'))[0] ?? [];
    expect(head).not.toContain('cost_price');
    expect(head).toContain('price');

    const withCost = (await createStaffWith(app, ['products.export', 'products.view_cost'])).agent;
    const expCost = await download(withCost, `${P}/export?format=csv`).expect(200);
    const rowsCost = parseCsv((expCost.body as Buffer).toString('utf8'));
    const ci = (rowsCost[0] ?? []).indexOf('cost_price');
    expect(ci).toBeGreaterThan(-1);
    expect(rowsCost.map((r) => r[ci])).toContain('5.00');

    const importer = (await createStaffWith(app, ['products.import'])).agent;
    const changed = baseRows();
    (changed[0] as R).price = '1400';
    const res = await importFile(importer, csvOf(changed)).expect(400);
    expect(res.body.errors[0]).toMatchObject({ row: 2, column: 'price' });
    const withCostCol = baseRows();
    (withCostCol[0] as R).cost_price = '7';
    const res2 = await importFile(importer, csvOf(withCostCol)).expect(400);
    expect(res2.body.errors.map((e: { column: string }) => e.column)).toContain('cost_price');
    // unchanged prices pass without products.edit_price
    await importFile(importer, csvOf(baseRows())).expect(200);

    const priced: PermissionKey[] = [
      'products.import',
      'products.edit_price',
      'products.view_cost',
    ];
    const full = (await createStaffWith(app, priced)).agent;
    await importFile(full, csvOf(withCostCol)).expect(200);
    expect((await prisma.variant.findUniqueOrThrow({ where: { sku: 'TB-RED' } })).costP).toBe(700);
  });

  it('serves a template with a header and two example rows', async () => {
    for (const format of ['csv', 'xlsx'] as const) {
      const res = await download(owner, `${P}/import-template?format=${format}`).expect(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      if (format === 'csv') {
        const recs = parseCsv((res.body as Buffer).toString('utf8'));
        expect(recs).toHaveLength(3);
        expect(recs[0]).toContain('attr:material');
      } else {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(res.body as Buffer);
        expect(wb.worksheets[0]?.rowCount).toBe(3);
        expect(wb.worksheets[1]?.name).toBe('Columns');
      }
    }
  });

  it('refuses activation of an unpriced product', async () => {
    const rows = baseRows().slice(2);
    (rows[0] as R).status = 'active';
    (rows[0] as R).price = '0';
    const res = await importFile(owner, csvOf(rows)).expect(400);
    expect(res.body.errors[0]).toMatchObject({ column: 'status' });
  });

  it('accepts partial files that only touch some columns', async () => {
    await importFile(owner, csvOf(baseRows())).expect(200);
    const res = await importFile(
      owner,
      csvOf([{ product_slug: 'teddy', sku: 'TB-RED', on_hand: '12' }]),
    ).expect(200);
    expect(res.body.variants).toEqual({ create: 0, update: 1, unchanged: 0 });
    const v = await prisma.variant.findUniqueOrThrow({
      where: { sku: 'TB-RED' },
      include: { inventory: true },
    });
    expect(v.inventory?.onHand).toBe(12);
    expect(v.priceP).toBe(125050);
    expect(await prisma.variant.count({ where: { product: { slug: 'teddy' } } })).toBe(2);
  });
});
