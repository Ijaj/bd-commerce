import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type StockReason } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { InventoryQueryDto, InventoryRowDto, MovementsQueryDto } from './inventory.dto';

export interface StockMoveInput {
  variantId: string;
  qtyDelta: number;
  reservedDelta: number;
  reason: StockReason;
  refType?: string;
  refId?: string;
  staffId?: string;
  note?: string;
}

export interface StockLevel {
  onHand: number;
  reserved: number;
  available: number;
}

interface LockedRow {
  on_hand: number;
  reserved: number;
  fulfillment: 'stock' | 'dropship';
}

interface ListRow {
  variant_id: string;
  product_id: string;
  title_en: string;
  title_bn: string | null;
  fulfillment: 'stock' | 'dropship';
  sku: string;
  options: { en: string; bn: string | null }[];
  on_hand: number;
  reserved: number;
  low_stock_threshold: number | null;
  total: bigint;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The only way stock changes. Must run inside a transaction: locks the inventory row,
   * applies the deltas, enforces the stock rules and appends a ledger row.
   */
  async move(tx: Prisma.TransactionClient, input: StockMoveInput): Promise<StockLevel> {
    const row = await this.lock(tx, input.variantId);
    const onHand = row.on_hand + input.qtyDelta;
    const reserved = row.reserved + input.reservedDelta;
    if (onHand < 0 || reserved < 0 || (row.fulfillment === 'stock' && reserved > onHand)) {
      throw new ConflictException('Not enough stock');
    }
    if (input.qtyDelta === 0 && input.reservedDelta === 0) {
      return { onHand, reserved, available: onHand - reserved };
    }
    await tx.inventory.update({
      where: { variantId: input.variantId },
      data: { onHand, reserved },
    });
    await tx.stockMovement.create({
      data: {
        variantId: input.variantId,
        qtyDelta: input.qtyDelta,
        reservedDelta: input.reservedDelta,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        staffId: input.staffId,
        note: input.note,
      },
    });
    return { onHand, reserved, available: onHand - reserved };
  }

  /** Current on-hand under a row lock (for "set to N" adjustments inside a transaction). */
  async lockedOnHand(tx: Prisma.TransactionClient, variantId: string): Promise<number> {
    return (await this.lock(tx, variantId)).on_hand;
  }

  async adjust(
    staffId: string,
    variantId: string,
    mode: 'delta' | 'set',
    qty: number,
    note: string,
  ): Promise<InventoryRowDto> {
    await this.prisma.$transaction(async (tx) => {
      const qtyDelta = mode === 'set' ? qty - (await this.lockedOnHand(tx, variantId)) : qty;
      await this.move(tx, {
        variantId,
        qtyDelta,
        reservedDelta: 0,
        reason: 'adjust',
        staffId,
        note,
      });
    });
    return this.getRow(variantId);
  }

  async setThreshold(
    variantId: string,
    lowStockThreshold: number | null,
  ): Promise<InventoryRowDto> {
    await this.assertVariant(this.prisma, variantId);
    await this.prisma.inventory.upsert({
      where: { variantId },
      create: { variantId, lowStockThreshold },
      update: { lowStockThreshold },
    });
    return this.getRow(variantId);
  }

  async list(query: InventoryQueryDto) {
    const where = this.filters(query);
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.prisma.$queryRaw<ListRow[]>(
      this.listSql(where, query.pageSize, offset),
    );
    return {
      items: rows.map(toRow),
      total: Number(rows[0]?.total ?? (await this.countFiltered(where))),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Active variants of non-archived products that are at or below their threshold. */
  async lowStockCount(): Promise<number> {
    const [res] = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count
      FROM variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE i.low_stock_threshold IS NOT NULL
        AND coalesce(i.on_hand, 0) - coalesce(i.reserved, 0) <= i.low_stock_threshold
        AND p.status <> 'archived' AND v.is_active`;
    return Number(res?.count ?? 0);
  }

  async movements(variantId: string, query: MovementsQueryDto) {
    await this.assertVariant(this.prisma, variantId);
    const [total, rows] = await Promise.all([
      this.prisma.stockMovement.count({ where: { variantId } }),
      this.prisma.stockMovement.findMany({
        where: { variantId },
        orderBy: [{ at: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { staff: { select: { id: true, name: true } } },
      }),
    ]);
    return {
      items: rows.map((m) => ({
        id: m.id,
        qtyDelta: m.qtyDelta,
        reservedDelta: m.reservedDelta,
        reason: m.reason,
        refType: m.refType,
        refId: m.refId,
        note: m.note,
        staff: m.staff,
        at: m.at.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async getRow(variantId: string): Promise<InventoryRowDto> {
    const [row] = await this.prisma.$queryRaw<ListRow[]>(
      this.listSql(Prisma.sql`v.id = ${variantId}::uuid`, 1, 0),
    );
    if (!row) throw new NotFoundException('Variant not found');
    return toRow(row);
  }

  private filters(q: InventoryQueryDto): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q.q) {
      const like = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
      parts.push(
        Prisma.sql`(v.sku ILIKE ${like} OR p.title_en ILIKE ${like} OR p.title_bn ILIKE ${like})`,
      );
    }
    if (q.lowStock === 'true') {
      parts.push(Prisma.sql`i.low_stock_threshold IS NOT NULL
        AND coalesce(i.on_hand, 0) - coalesce(i.reserved, 0) <= i.low_stock_threshold
        AND p.status <> 'archived' AND v.is_active`);
    }
    if (q.fulfillment) parts.push(Prisma.sql`p.fulfillment = ${q.fulfillment}::fulfillment`);
    if (q.categoryId) {
      parts.push(Prisma.sql`EXISTS (
        SELECT 1 FROM product_categories pc
        JOIN categories c ON c.id = pc.category_id
        WHERE pc.product_id = p.id
          AND c.path LIKE (SELECT path FROM categories WHERE id = ${q.categoryId}::uuid) || '%')`);
    }
    return Prisma.join(parts, ' AND ');
  }

  private listSql(where: Prisma.Sql, limit: number, offset: number) {
    return Prisma.sql`
      SELECT v.id AS variant_id, p.id AS product_id, p.title_en, p.title_bn, p.fulfillment, v.sku,
        coalesce((
          SELECT json_agg(json_build_object('en', ov.value_en, 'bn', ov.value_bn) ORDER BY o.position)
          FROM product_option_values ov
          JOIN product_options o ON o.id = ov.option_id
          WHERE ov.id IN (v.option_value_1_id, v.option_value_2_id)), '[]'::json) AS options,
        coalesce(i.on_hand, 0) AS on_hand, coalesce(i.reserved, 0) AS reserved,
        i.low_stock_threshold,
        count(*) OVER () AS total
      FROM variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE ${where}
      ORDER BY p.title_en, v.sort, v.sku
      LIMIT ${limit} OFFSET ${offset}`;
  }

  private async countFiltered(where: Prisma.Sql): Promise<number> {
    const [res] = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE ${where}`;
    return Number(res?.count ?? 0);
  }

  private async assertVariant(db: Prisma.TransactionClient | PrismaService, variantId: string) {
    const found = await db.variant.findUnique({ where: { id: variantId }, select: { id: true } });
    if (!found) throw new NotFoundException('Variant not found');
  }

  /** Creates the inventory row when missing, then locks it (FOR UPDATE) until the transaction ends. */
  private async lock(tx: Prisma.TransactionClient, variantId: string): Promise<LockedRow> {
    const select = () => tx.$queryRaw<LockedRow[]>`
      SELECT i.on_hand, i.reserved, p.fulfillment
      FROM inventory i
      JOIN variants v ON v.id = i.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE i.variant_id = ${variantId}::uuid
      FOR UPDATE OF i`;
    let [row] = await select();
    if (!row) {
      await this.assertVariant(tx, variantId);
      await tx.$executeRaw`
        INSERT INTO inventory (variant_id, on_hand, reserved, updated_at)
        VALUES (${variantId}::uuid, 0, 0, now())
        ON CONFLICT (variant_id) DO NOTHING`;
      [row] = await select();
    }
    if (!row) throw new NotFoundException('Variant not found');
    return row;
  }
}

function toRow(r: ListRow): InventoryRowDto {
  const available = r.on_hand - r.reserved;
  return {
    variantId: r.variant_id,
    productId: r.product_id,
    productTitleEn: r.title_en,
    productTitleBn: r.title_bn,
    fulfillment: r.fulfillment,
    sku: r.sku,
    optionLabels: r.options,
    onHand: r.on_hand,
    reserved: r.reserved,
    available,
    lowStockThreshold: r.low_stock_threshold,
    isLow: r.low_stock_threshold !== null && available <= r.low_stock_threshold,
  };
}
