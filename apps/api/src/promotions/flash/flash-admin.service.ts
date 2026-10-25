import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { effectivePrice } from '../../storefront/pricing';
import type {
  FlashItemsReplaceDto,
  FlashSaleCreateDto,
  FlashSaleListQueryDto,
  FlashSaleUpdateDto,
} from './flash.dto';
import { FlashError } from './flash.errors';

type Phase = 'scheduled' | 'live' | 'ended' | 'inactive';

export function flashPhase(
  s: { isActive: boolean; startsAt: Date; endsAt: Date },
  now: Date,
): Phase {
  if (!s.isActive) return 'inactive';
  if (now < s.startsAt) return 'scheduled';
  if (now >= s.endsAt) return 'ended';
  return 'live';
}

const itemInclude = {
  variant: {
    select: {
      sku: true,
      priceP: true,
      compareAtP: true,
      salePriceP: true,
      saleStartsAt: true,
      saleEndsAt: true,
      product: { select: { id: true, titleEn: true } },
    },
  },
} satisfies Prisma.FlashSaleItemInclude;

@Injectable()
export class FlashAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: FlashSaleListQueryDto) {
    const now = new Date();
    const where: Prisma.FlashSaleWhereInput = {};
    if (q.q) where.nameEn = { contains: q.q, mode: 'insensitive' };
    if (q.phase === 'inactive') where.isActive = false;
    else if (q.phase) {
      where.isActive = true;
      if (q.phase === 'scheduled') where.startsAt = { gt: now };
      else if (q.phase === 'ended') where.endsAt = { lte: now };
      else Object.assign(where, { startsAt: { lte: now }, endsAt: { gt: now } });
    }
    const [total, rows] = await Promise.all([
      this.prisma.flashSale.count({ where }),
      this.prisma.flashSale.findMany({
        where,
        include: { items: { select: { qtySold: true } } },
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => this.summary(r, now)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async detail(id: string) {
    const sale = await this.prisma.flashSale.findUnique({
      where: { id },
      include: {
        items: { include: itemInclude, orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!sale) throw notFound();
    const now = new Date();
    return {
      ...this.summary(sale, now),
      items: sale.items.map((i) => ({
        id: i.id,
        variantId: i.variantId,
        productId: i.variant.product.id,
        productTitleEn: i.variant.product.titleEn,
        sku: i.variant.sku,
        priceP: i.variant.priceP,
        currentSalePriceP: (() => {
          const p = effectivePrice(i.variant, now);
          return p.source === 'sale' ? p.priceP : null;
        })(),
        flashPriceP: i.flashPriceP,
        qtyLimit: i.qtyLimit,
        qtySold: i.qtySold,
        perCustomerLimit: i.perCustomerLimit,
        sort: i.sort,
      })),
    };
  }

  async create(body: FlashSaleCreateDto) {
    const sale = await this.prisma.flashSale.create({
      data: {
        nameEn: body.nameEn,
        nameBn: body.nameBn ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        isActive: body.isActive ?? true,
      },
    });
    return this.detail(sale.id);
  }

  async update(id: string, body: FlashSaleUpdateDto) {
    await this.locked(async (tx) => {
      const cur = await tx.flashSale.findUnique({ where: { id }, include: { items: true } });
      if (!cur) throw notFound();
      const next = {
        startsAt: body.startsAt ? new Date(body.startsAt) : cur.startsAt,
        endsAt: body.endsAt ? new Date(body.endsAt) : cur.endsAt,
        isActive: body.isActive ?? cur.isActive,
      };
      if (next.endsAt <= next.startsAt) {
        throw new FlashError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'FLASH_INVALID',
          'endsAt must be after startsAt',
        );
      }
      const moved =
        next.startsAt.getTime() !== cur.startsAt.getTime() ||
        next.endsAt.getTime() !== cur.endsAt.getTime() ||
        (next.isActive && !cur.isActive);
      if (moved && next.isActive) {
        await this.assertNoOverlap(
          tx,
          id,
          cur.items.map((i) => i.variantId),
          next,
        );
      }
      await tx.flashSale.update({
        where: { id },
        data: {
          nameEn: body.nameEn,
          nameBn: body.nameBn,
          startsAt: body.startsAt ? next.startsAt : undefined,
          endsAt: body.endsAt ? next.endsAt : undefined,
          isActive: body.isActive,
        },
      });
    });
    return this.detail(id);
  }

  async remove(id: string) {
    await this.locked(async (tx) => {
      const sale = await tx.flashSale.findUnique({ where: { id }, include: { items: true } });
      if (!sale) throw notFound();
      if (sale.items.some((i) => i.qtySold > 0)) {
        throw new FlashError(
          HttpStatus.CONFLICT,
          'FLASH_HAS_SALES',
          'This flash sale already has sales. Deactivate it instead of deleting.',
        );
      }
      await tx.flashSale.delete({ where: { id } });
    });
  }

  /** Replaces the item list. Existing items keep their qtySold; items with sales cannot be dropped. */
  async replaceItems(id: string, body: FlashItemsReplaceDto) {
    const wanted = body.items;
    const variantIds = wanted.map((i) => i.variantId);
    if (new Set(variantIds).size !== variantIds.length) {
      throw new FlashError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FLASH_INVALID',
        'A variant appears twice',
      );
    }
    await this.locked(async (tx) => {
      const sale = await tx.flashSale.findUnique({ where: { id }, include: { items: true } });
      if (!sale) throw notFound();
      const variants = await tx.variant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, priceP: true, sku: true },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));
      const existing = new Map(sale.items.map((i) => [i.variantId, i]));

      for (const w of wanted) {
        const v = byId.get(w.variantId);
        if (!v) {
          throw new FlashError(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'FLASH_INVALID',
            `Variant ${w.variantId} not found`,
          );
        }
        if (w.flashPriceP >= v.priceP) {
          throw new FlashError(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'FLASH_INVALID',
            `Flash price for ${v.sku} must be lower than its regular price`,
          );
        }
        const old = existing.get(w.variantId);
        if (old && w.qtyLimit < old.qtySold) {
          throw new FlashError(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'FLASH_INVALID',
            `Quantity for ${v.sku} cannot be below the ${old.qtySold} already sold`,
          );
        }
      }
      const dropped = sale.items.filter((i) => !variantIds.includes(i.variantId));
      if (dropped.some((i) => i.qtySold > 0)) {
        throw new FlashError(
          HttpStatus.CONFLICT,
          'FLASH_HAS_SALES',
          'Items that already sold cannot be removed',
        );
      }
      if (sale.isActive) await this.assertNoOverlap(tx, id, variantIds, sale);

      await tx.flashSaleItem.deleteMany({
        where: { flashSaleId: id, variantId: { notIn: variantIds } },
      });
      for (const w of wanted) {
        const data = {
          flashPriceP: w.flashPriceP,
          qtyLimit: w.qtyLimit,
          perCustomerLimit: w.perCustomerLimit,
          sort: w.sort,
        };
        const old = existing.get(w.variantId);
        if (old) await tx.flashSaleItem.update({ where: { id: old.id }, data });
        else
          await tx.flashSaleItem.create({
            data: { ...data, flashSaleId: id, variantId: w.variantId },
          });
      }
    });
    return this.detail(id);
  }

  /** One writer at a time: overlap checks read other sales, so concurrent saves must not interleave. */
  private locked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('flash_sales'))`;
      return fn(tx);
    });
  }

  /** A variant may sit in only one active flash sale per time window (409 with the clashing sale name). */
  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    saleId: string,
    variantIds: string[],
    window: { startsAt: Date; endsAt: Date },
  ) {
    if (variantIds.length === 0) return;
    const clash = await tx.flashSaleItem.findFirst({
      where: {
        variantId: { in: variantIds },
        flashSaleId: { not: saleId },
        flashSale: {
          isActive: true,
          startsAt: { lt: window.endsAt },
          endsAt: { gt: window.startsAt },
        },
      },
      include: { flashSale: { select: { nameEn: true } }, variant: { select: { sku: true } } },
    });
    if (clash) {
      throw new FlashError(
        HttpStatus.CONFLICT,
        'FLASH_OVERLAP',
        `${clash.variant.sku} is already in "${clash.flashSale.nameEn}" at the same time`,
        { saleName: clash.flashSale.nameEn, variantId: clash.variantId },
      );
    }
  }

  private summary(
    s: {
      id: string;
      nameEn: string;
      nameBn: string | null;
      startsAt: Date;
      endsAt: Date;
      isActive: boolean;
      items: { qtySold: number }[];
    },
    now: Date,
  ) {
    return {
      id: s.id,
      nameEn: s.nameEn,
      nameBn: s.nameBn,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      isActive: s.isActive,
      phase: flashPhase(s, now),
      itemCount: s.items.length,
      unitsSold: s.items.reduce((n, i) => n + i.qtySold, 0),
    };
  }
}

function notFound() {
  return new FlashError(HttpStatus.NOT_FOUND, 'FLASH_NOT_FOUND', 'Flash sale not found');
}
