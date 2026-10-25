import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  BulkSaleCreateDto,
  BulkSaleItemsQueryDto,
  BulkSaleListQueryDto,
  BulkSalePreviewDto,
} from './bulk-sale.dto';
import { BulkSaleError } from './bulk-sale.errors';
import { type BulkPlan, MAX_VARIANTS, planBulkSale, tooManyError } from './bulk-sale.plan';

const SAMPLE = 50;

type BatchRow = Prisma.SaleBatchGetPayload<{ include: { _count: { select: { items: true } } } }>;

@Injectable()
export class BulkSaleService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(body: BulkSalePreviewDto) {
    const plan = await planBulkSale(this.prisma, body, new Date());
    return {
      count: plan.planned.length,
      skipped: plan.skippedExisting + plan.skippedPrice,
      skippedExisting: plan.skippedExisting,
      skippedPrice: plan.skippedPrice,
      tooMany: plan.tooBroad || plan.planned.length > MAX_VARIANTS,
      limit: MAX_VARIANTS,
      sample: plan.planned.slice(0, SAMPLE).map((p) => ({
        variantId: p.variantId,
        sku: p.sku,
        title: p.title,
        priceP: p.priceP,
        currentSalePriceP: p.currentSalePriceP,
        newSalePriceP: p.newSalePriceP,
      })),
    };
  }

  /** Writes sale prices and the undo log in one transaction (re-planned inside it, so prices are fresh). */
  async apply(staffId: string, body: BulkSaleCreateDto) {
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    const id = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bulk_sales'))`;
        const plan: BulkPlan = await planBulkSale(tx, body, new Date());
        if (plan.tooBroad || plan.planned.length > MAX_VARIANTS) {
          throw tooManyError(plan.tooBroad ? 20_000 : plan.planned.length);
        }
        const batch = await tx.saleBatch.create({
          data: {
            name: body.name,
            config: { mode: body.mode, value: body.value, scope: body.scope },
            startsAt,
            endsAt,
            createdById: staffId,
          },
        });
        if (plan.planned.length > 0) {
          await tx.saleBatchItem.createMany({
            data: plan.planned.map((p) => ({
              batchId: batch.id,
              variantId: p.variantId,
              prevSalePriceP: p.prevSalePriceP,
              prevSaleStartsAt: p.prevSaleStartsAt,
              prevSaleEndsAt: p.prevSaleEndsAt,
              newSalePriceP: p.newSalePriceP,
            })),
          });
          await tx.$executeRaw`UPDATE variants v
            SET sale_price_p = x.price, sale_starts_at = ${startsAt}::timestamptz,
                sale_ends_at = ${endsAt}::timestamptz, updated_at = now()
            FROM unnest(${plan.planned.map((p) => p.variantId)}::uuid[], ${plan.planned.map((p) => p.newSalePriceP)}::int[])
              AS x(id, price)
            WHERE v.id = x.id`;
        }
        return batch.id;
      },
      { timeout: 60_000 },
    );
    return this.detail(id, { page: 1, pageSize: 50 });
  }

  async list(q: BulkSaleListQueryDto) {
    const [total, rows] = await Promise.all([
      this.prisma.saleBatch.count(),
      this.prisma.saleBatch.findMany({
        include: { _count: { select: { items: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    const names = await this.staffNames(rows.map((r) => r.createdById));
    return {
      items: rows.map((r) => this.batchDto(r, names)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async detail(id: string, q: Pick<BulkSaleItemsQueryDto, 'page' | 'pageSize'>) {
    const batch = await this.prisma.saleBatch.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!batch) throw notFound();
    const [items, names] = await Promise.all([
      this.prisma.saleBatchItem.findMany({
        where: { batchId: id },
        include: {
          variant: { select: { sku: true, priceP: true, product: { select: { titleEn: true } } } },
        },
        orderBy: [{ variant: { sku: 'asc' } }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.staffNames([batch.createdById]),
    ]);
    return {
      ...this.batchDto(batch, names),
      items: items.map((i) => ({
        variantId: i.variantId,
        sku: i.variant.sku,
        title: i.variant.product.titleEn,
        priceP: i.variant.priceP,
        prevSalePriceP: i.prevSalePriceP,
        newSalePriceP: i.newSalePriceP,
      })),
      total: batch._count.items,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /**
   * Restores the previous sale fields, but only on variants whose sale fields still equal what the
   * batch wrote; anything edited since is left alone and counted.
   */
  async undo(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bulk_sales'))`;
        const batch = await tx.saleBatch.findUnique({ where: { id } });
        if (!batch) throw notFound();
        if (batch.undoneAt) {
          throw new BulkSaleError(
            HttpStatus.CONFLICT,
            'BULK_SALE_UNDONE',
            'This bulk sale was already undone',
          );
        }
        const total = await tx.saleBatchItem.count({ where: { batchId: id } });
        const restored = await tx.$executeRaw`UPDATE variants v
        SET sale_price_p = i.prev_sale_price_p, sale_starts_at = i.prev_sale_starts_at,
            sale_ends_at = i.prev_sale_ends_at, updated_at = now()
        FROM sale_batch_items i
        WHERE i.batch_id = ${id}::uuid AND i.variant_id = v.id
          AND v.sale_price_p IS NOT DISTINCT FROM i.new_sale_price_p
          AND v.sale_starts_at IS NOT DISTINCT FROM ${batch.startsAt}::timestamptz
          AND v.sale_ends_at IS NOT DISTINCT FROM ${batch.endsAt}::timestamptz`;
        await tx.saleBatch.update({ where: { id }, data: { undoneAt: new Date() } });
        return { restored, skippedChanged: total - restored };
      },
      { timeout: 60_000 },
    );
  }

  private async staffNames(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    if (wanted.length === 0) return new Map<string, string>();
    const rows = await this.prisma.staff.findMany({
      where: { id: { in: wanted } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private batchDto(b: BatchRow, names: Map<string, string>) {
    const cfg = b.config as {
      mode: 'percent' | 'fixed';
      value: number;
      scope: { productIds?: string[]; categoryIds?: string[]; brandIds?: string[] };
    };
    return {
      id: b.id,
      name: b.name,
      mode: cfg.mode,
      value: cfg.value,
      scope: {
        productIds: cfg.scope.productIds ?? [],
        categoryIds: cfg.scope.categoryIds ?? [],
        brandIds: cfg.scope.brandIds ?? [],
      },
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
      createdByName: b.createdById ? (names.get(b.createdById) ?? null) : null,
      undoneAt: b.undoneAt?.toISOString() ?? null,
      itemCount: b._count.items,
    };
  }
}

function notFound() {
  return new BulkSaleError(HttpStatus.NOT_FOUND, 'BULK_SALE_NOT_FOUND', 'Bulk sale not found');
}
