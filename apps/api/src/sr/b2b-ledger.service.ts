import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LedgerType } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { B2bAdjustDto, B2bLedgerView, SrCreateCollectionDto } from './sr.dto';
import { MAX_MONEY_P, srError } from './sr.util';

const ledgerInclude = {
  shop: { select: { name: true } },
  sale: { select: { memoNo: true } },
  recordedBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
} satisfies Prisma.B2bLedgerInclude;

type LedgerRow = Prisma.B2bLedgerGetPayload<{ include: typeof ledgerInclude }>;

export function toLedgerView(r: LedgerRow): B2bLedgerView {
  return {
    id: r.id,
    b2bShopId: r.b2bShopId,
    shopName: r.shop.name,
    type: r.type,
    amountP: r.amountP,
    method: r.method,
    srSaleId: r.srSaleId,
    memoNo: r.sale?.memoNo ?? null,
    recordedBy: r.recordedBy,
    confirmed: r.confirmedAt !== null,
    confirmedBy: r.confirmedBy,
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    rejected: r.rejectedAt !== null,
    rejectedBy: r.rejectedBy,
    rejectedAt: r.rejectedAt?.toISOString() ?? null,
    rejectReason: r.rejectReason,
    note: r.note,
    at: r.at.toISOString(),
  };
}

/**
 * Every write to b2b_ledger goes through here. The shop row is locked first, so ledger rows and
 * the shop's `due_balance_p` cache change together and concurrent writers queue up.
 */
@Injectable()
export class B2bLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async lockShop(tx: Prisma.TransactionClient, shopId: string) {
    const [row] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM b2b_shops WHERE id = ${shopId}::uuid FOR UPDATE`;
    if (!row) throw new NotFoundException('Shop not found');
    return row;
  }

  /**
   * due = sale_due + adjustments + reversals + confirmed collections (collections are negative).
   * Summed as bigint so a runaway ledger errors out instead of wrapping around int4.
   */
  async recompute(tx: Prisma.TransactionClient, shopId: string): Promise<number> {
    const [sum] = await tx.$queryRaw<{ due: bigint }[]>`
      SELECT coalesce(sum(amount_p), 0)::bigint AS due FROM b2b_ledger
      WHERE b2b_shop_id = ${shopId}::uuid AND (type <> 'collection' OR confirmed_at IS NOT NULL)`;
    const due = Number(sum?.due ?? 0);
    if (Math.abs(due) > MAX_MONEY_P) {
      throw srError(ConflictException, 'LEDGER_OVERFLOW', 'Shop balance is out of range');
    }
    await tx.$executeRaw`
      UPDATE b2b_shops SET due_balance_p = ${due}::int, updated_at = now()
      WHERE id = ${shopId}::uuid`;
    return due;
  }

  /** Caller holds the shop lock. `confirmedById` set = counts at once (sale dues, adjustments). */
  async append(
    tx: Prisma.TransactionClient,
    input: {
      shopId: string;
      type: LedgerType;
      amountP: number;
      recordedById: string;
      confirmedById?: string;
      srSaleId?: string;
      method?: string;
      note?: string | null;
    },
  ) {
    const row = await tx.b2bLedger.create({
      data: {
        b2bShopId: input.shopId,
        type: input.type,
        amountP: input.amountP,
        recordedById: input.recordedById,
        srSaleId: input.srSaleId,
        method: input.method,
        note: input.note ?? null,
        confirmedById: input.confirmedById,
        confirmedAt: input.confirmedById ? new Date() : null,
      },
      include: ledgerInclude,
    });
    await this.recompute(tx, input.shopId);
    return row;
  }

  /** SR records money collected from a shop; counts only after staff confirm (R18). */
  async recordCollection(srStaffId: string, dto: SrCreateCollectionDto): Promise<B2bLedgerView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockShop(tx, dto.b2bShopId);
      const [bal] = await tx.$queryRaw<{ due: number; pending: number }[]>`
        SELECT s.due_balance_p AS due,
          coalesce((SELECT -sum(l.amount_p) FROM b2b_ledger l
            WHERE l.b2b_shop_id = s.id AND l.type = 'collection'
              AND l.confirmed_at IS NULL AND l.rejected_at IS NULL), 0)::int AS pending
        FROM b2b_shops s WHERE s.id = ${dto.b2bShopId}::uuid`;
      const open = (bal?.due ?? 0) - (bal?.pending ?? 0);
      if (dto.amountP > open) {
        throw srError(
          ConflictException,
          'EXCEEDS_DUE',
          `Amount is more than the shop's open due (${open} paisa)`,
        );
      }
      const row = await this.append(tx, {
        shopId: dto.b2bShopId,
        type: 'collection',
        amountP: -dto.amountP,
        method: dto.method,
        recordedById: srStaffId,
        note: dto.note,
      });
      return toLedgerView(row);
    });
  }

  async confirm(ledgerId: string, staffId: string): Promise<B2bLedgerView> {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.b2bLedger.findUnique({
        where: { id: ledgerId },
        select: { b2bShopId: true, type: true, recordedById: true },
      });
      if (!found) throw new NotFoundException('Ledger entry not found');
      if (found.type !== 'collection') {
        throw srError(ConflictException, 'NOT_A_COLLECTION', 'Only collections need confirming');
      }
      if (found.recordedById === staffId) {
        throw srError(ForbiddenException, 'SELF_CONFIRM', 'You cannot confirm your own collection');
      }
      await this.lockShop(tx, found.b2bShopId);
      // The trigger allows exactly this update: confirmed_* from null, nothing else.
      const done = await tx.b2bLedger.updateMany({
        where: { id: ledgerId, confirmedAt: null, rejectedAt: null },
        data: { confirmedById: staffId, confirmedAt: new Date() },
      });
      if (done.count === 0) await this.alreadyResolved(tx, ledgerId);
      await this.recompute(tx, found.b2bShopId);
      const row = await tx.b2bLedger.findUniqueOrThrow({
        where: { id: ledgerId },
        include: ledgerInclude,
      });
      return toLedgerView(row);
    });
  }

  /** Staff turns down a pending collection; it never counts (C43). */
  async reject(ledgerId: string, staffId: string, reason: string): Promise<B2bLedgerView> {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.b2bLedger.findUnique({
        where: { id: ledgerId },
        select: { b2bShopId: true, type: true },
      });
      if (!found) throw new NotFoundException('Ledger entry not found');
      if (found.type !== 'collection') {
        throw srError(ConflictException, 'NOT_A_COLLECTION', 'Only collections can be rejected');
      }
      await this.lockShop(tx, found.b2bShopId);
      const done = await tx.b2bLedger.updateMany({
        where: { id: ledgerId, confirmedAt: null, rejectedAt: null },
        data: { rejectedById: staffId, rejectedAt: new Date(), rejectReason: reason },
      });
      if (done.count === 0) await this.alreadyResolved(tx, ledgerId);
      const row = await tx.b2bLedger.findUniqueOrThrow({
        where: { id: ledgerId },
        include: ledgerInclude,
      });
      return toLedgerView(row);
    });
  }

  private async alreadyResolved(tx: Prisma.TransactionClient, ledgerId: string): Promise<never> {
    const row = await tx.b2bLedger.findUniqueOrThrow({
      where: { id: ledgerId },
      select: { rejectedAt: true },
    });
    throw row.rejectedAt
      ? srError(ConflictException, 'ALREADY_REJECTED', 'Collection is already rejected')
      : srError(ConflictException, 'ALREADY_CONFIRMED', 'Collection is already confirmed');
  }

  async adjust(shopId: string, staffId: string, dto: B2bAdjustDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockShop(tx, shopId);
      const row = await this.append(tx, {
        shopId,
        type: 'adjustment',
        amountP: dto.amountP,
        recordedById: staffId,
        confirmedById: staffId,
        note: dto.note,
      });
      const shop = await tx.b2bShop.findUniqueOrThrow({
        where: { id: shopId },
        select: { dueBalanceP: true },
      });
      return { entry: toLedgerView(row), dueBalanceP: shop.dueBalanceP };
    });
  }

  async shopLedger(shopId: string, page: number, pageSize: number) {
    return this.page({ b2bShopId: shopId }, page, pageSize);
  }

  /** Staff queue: collections waiting for confirmation (default), confirmed or rejected. */
  async collections(
    status: 'pending' | 'confirmed' | 'rejected' | 'all',
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.B2bLedgerWhereInput = { type: 'collection' };
    if (status === 'pending') Object.assign(where, { confirmedAt: null, rejectedAt: null });
    if (status === 'confirmed') where.confirmedAt = { not: null };
    if (status === 'rejected') where.rejectedAt = { not: null };
    return this.page(where, page, pageSize);
  }

  /** One SR's own collections. */
  async collectionsOf(srStaffId: string, page: number, pageSize: number) {
    return this.page({ type: 'collection', recordedById: srStaffId }, page, pageSize);
  }

  /** The SR's own ledger entries for one shop (sale dues of own sales, own collections). */
  async ownEntries(shopId: string, srStaffId: string): Promise<B2bLedgerView[]> {
    const rows = await this.prisma.b2bLedger.findMany({
      where: { b2bShopId: shopId, recordedById: srStaffId },
      orderBy: { id: 'desc' },
      take: 100,
      include: ledgerInclude,
    });
    return rows.map(toLedgerView);
  }

  private async page(where: Prisma.B2bLedgerWhereInput, page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.b2bLedger.count({ where }),
      this.prisma.b2bLedger.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: ledgerInclude,
      }),
    ]);
    return { items: rows.map(toLedgerView), total, page, pageSize };
  }
}
