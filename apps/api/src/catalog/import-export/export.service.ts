import { Injectable } from '@nestjs/common';
import type { PermissionKey } from '../../auth/permissions';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListProductsQueryDto } from '../products/products.dto';
import { ProductsService } from '../products/products.service';
import { ATTR_PREFIX, COLUMNS, COST_COLUMN } from './columns';
import { type CellValue, writeCsv, writeXlsx } from './file-io';
import type { ExportQueryDto } from './import-export.dto';
import { formatPaisa } from './parse';

export type FileFormat = 'xlsx' | 'csv';
export interface BuiltFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const CONTENT_TYPES: Record<FileFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};
const PRICE_COLUMNS = new Set(['price', 'compare_at_price', 'sale_price', COST_COLUMN]);
const INT_COLUMNS = new Set(['weight_g', 'weight_g_variant', 'on_hand', 'low_stock_threshold']);

const exportInclude = {
  brand: { select: { slug: true } },
  primaryCategory: { select: { slug: true } },
  categories: { include: { category: { select: { slug: true } } } },
  attributeValues: {
    include: {
      attribute: { select: { key: true, type: true } },
      option: { select: { valueEn: true } },
    },
  },
  options: { include: { values: true }, orderBy: { position: 'asc' } },
  variants: {
    include: { inventory: true, optionValue1: true, optionValue2: true },
    orderBy: { sort: 'asc' },
  },
} as const;

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  private headers(perms: Set<PermissionKey>, attrKeys: string[]) {
    return [
      ...COLUMNS.map((c) => c.name).filter(
        (n) => n !== COST_COLUMN || perms.has('products.view_cost'),
      ),
      ...attrKeys.map((k) => `${ATTR_PREFIX}${k}`),
    ];
  }

  private async write(
    format: FileFormat,
    name: string,
    headers: string[],
    rows: CellValue[][],
    docs = false,
  ): Promise<BuiltFile> {
    const stamp = new Date().toISOString().slice(0, 10);
    const buffer =
      format === 'csv'
        ? writeCsv(headers, rows)
        : await writeXlsx(
            headers,
            rows,
            PRICE_COLUMNS,
            docs
              ? {
                  name: 'Columns',
                  headers: ['column', 'required to create', 'description'],
                  rows: [
                    ...COLUMNS.map((c) => [c.name, c.required ? 'yes' : 'no', c.description]),
                    [
                      `${ATTR_PREFIX}<key>`,
                      'no',
                      'Category attribute by key; multiselect values separated by |.',
                    ],
                  ],
                }
              : undefined,
          );
    return { buffer, contentType: CONTENT_TYPES[format], filename: `${name}-${stamp}.${format}` };
  }

  async template(format: FileFormat): Promise<BuiltFile> {
    const keys = (
      await this.prisma.categoryAttribute.findMany({
        distinct: ['key'],
        select: { key: true },
        orderBy: { key: 'asc' },
      })
    ).map((a) => a.key);
    const headers = this.headers(new Set(['products.view_cost']), keys);
    const rows = [0, 1].map((i) =>
      headers.map((h) => COLUMNS.find((c) => c.name === h)?.example[i] ?? ''),
    );
    return this.write(format, 'products-import-template', headers, rows, true);
  }

  async export(perms: Set<PermissionKey>, query: ExportQueryDto): Promise<BuiltFile> {
    const ids: string[] = [];
    for (let page = 1; ; page++) {
      const res = await this.products.list({
        page,
        pageSize: 100,
        sort: 'createdAt',
        order: 'asc',
        q: query.q,
        status: query.status,
        categoryId: query.categoryId,
        brandId: query.brandId,
      } as ListProductsQueryDto);
      ids.push(...res.items.map((i) => i.id));
      if (ids.length >= res.total || res.items.length === 0) break;
    }

    const rows: Record<string, CellValue>[] = [];
    const attrKeys = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const found = await this.prisma.product.findMany({
        where: { id: { in: chunk } },
        include: exportInclude,
      });
      const byId = new Map(found.map((p) => [p.id, p]));
      for (const id of chunk) {
        const p = byId.get(id);
        if (!p) continue;
        const attrs: Record<string, string> = {};
        for (const av of p.attributeValues) {
          const col = `${ATTR_PREFIX}${av.attribute.key}`;
          attrKeys.add(av.attribute.key);
          let text = '';
          switch (av.attribute.type) {
            case 'text':
              text = av.valueText ?? '';
              break;
            case 'number':
              text = av.valueNumber?.toString() ?? '';
              break;
            case 'boolean':
              text = String(av.valueBool);
              break;
            default:
              text = av.option?.valueEn ?? '';
          }
          attrs[col] = attrs[col] ? `${attrs[col]}|${text}` : text;
        }
        const optNames = [1, 2].map((pos) => p.options.find((o) => o.position === pos));
        const product: Record<string, CellValue> = {
          product_slug: p.slug,
          title_en: p.titleEn,
          title_bn: p.titleBn,
          status: p.status,
          brand_slug: p.brand?.slug ?? null,
          primary_category_slug: p.primaryCategory.slug,
          category_slugs: p.categories
            .filter((c) => c.categoryId !== p.primaryCategoryId)
            .map((c) => c.category.slug)
            .sort()
            .join('|'),
          fulfillment: p.fulfillment,
          short_description_en: p.shortDescriptionEn,
          short_description_bn: p.shortDescriptionBn,
          description_html_en: p.descriptionHtmlEn,
          description_html_bn: p.descriptionHtmlBn,
          youtube_url: p.youtubeUrl,
          weight_g: p.weightG,
          is_preorder: String(p.isPreorder),
          preorder_expected_date: p.preorderExpectedDate?.toISOString().slice(0, 10) ?? null,
          is_upcoming: String(p.isUpcoming),
          ...attrs,
        };
        for (const v of p.variants) {
          const values = [v.optionValue1, v.optionValue2];
          // Retired variants (options removed) have no combination and cannot be re-imported.
          if (optNames.some((o, idx) => o && !values[idx])) continue;
          const row: Record<string, CellValue> = { ...product };
          optNames.forEach((o, idx) => {
            const n = idx + 1;
            row[`option${n}_name_en`] = o?.nameEn ?? null;
            row[`option${n}_name_bn`] = o?.nameBn ?? null;
            row[`option${n}_value_en`] = values[idx]?.valueEn ?? null;
            row[`option${n}_value_bn`] = values[idx]?.valueBn ?? null;
          });
          Object.assign(row, {
            sku: v.sku,
            barcode: v.barcode,
            price: v.priceP,
            compare_at_price: v.compareAtP,
            sale_price: v.salePriceP,
            cost_price: v.costP,
            weight_g_variant: v.weightG,
            variant_active: String(v.isActive),
            on_hand: v.inventory?.onHand ?? 0,
            low_stock_threshold: v.inventory?.lowStockThreshold ?? null,
          });
          rows.push(row);
        }
      }
    }

    const keys = [...attrKeys].sort();
    const headers = this.headers(perms, keys);
    const csv = query.format === 'csv';
    const cells = rows.map((r) =>
      headers.map((h): CellValue => {
        const v = r[h] ?? null;
        if (PRICE_COLUMNS.has(h) && typeof v === 'number') {
          return csv ? formatPaisa(v) : v / 100;
        }
        if (INT_COLUMNS.has(h) && typeof v === 'number' && csv) return String(v);
        return v;
      }),
    );
    return this.write(query.format, 'products', headers, cells);
  }
}
