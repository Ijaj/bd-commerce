import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { B2bLedgerService } from './b2b-ledger.service';
import type {
  SrAdminSalesQueryDto,
  SrCreateSaleDto,
  SrSaleDetailView,
  SrSaleListView,
  SrSalesQueryDto,
} from './sr.dto';
import { MAX_MONEY_P, memoNumber, srError } from './sr.util';

const listInclude = {
  shop: { select: { id: true, name: true, phone: true } },
  sr: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  deliveredBy: { select: { id: true, name: true } },
  reversedBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.SrSaleInclude;

export const saleDetailInclude = {
  ...listInclude,
  items: {
    orderBy: { id: 'asc' },
    include: {
      variant: {
        select: {
          sku: true,
          product: { select: { titleEn: true, titleBn: true } },
          optionValue1: { select: { valueEn: true, valueBn: true } },
          optionValue2: { select: { valueEn: true, valueBn: true } },
        },
      },
    },
  },
} satisfies Prisma.SrSaleInclude;

type ListRow = Prisma.SrSaleGetPayload<{ include: typeof listInclude }>;
export type SaleDetailRow = Prisma.SrSaleGetPayload<{ include: typeof saleDetailInclude }>;

function toListView(s: ListRow): SrSaleListView {
  return {
    id: s.id,
    memoNo: s.memoNo,
    status: s.status,
    totalP: s.totalP,
    paidAtSaleP: s.paidAtSaleP,
    dueP: s.dueP,
    note: s.note,
    submittedAt: s.submittedAt.toISOString(),
    approvedAt: s.approvedAt?.toISOString() ?? null,
    approvedBy: s.approvedBy,
    rejectedReason: s.rejectedReason,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    deliveredBy: s.deliveredBy,
    deliveryBy: s.deliveryBy,
    reversedAt: s.reversedAt?.toISOString() ?? null,
    reversedBy: s.reversedBy,
    reverseReason: s.reverseReason,
    shop: s.shop,
    sr: s.sr,
    itemCount: s._count.items,
  };
}

export function toDetailView(s: SaleDetailRow): SrSaleDetailView {
  return {
    ...toListView(s),
    items: s.items.map((i) => {
      const opts = [i.variant.optionValue1, i.variant.optionValue2].filter((o) => o !== null);
      return {
        id: i.id,
        variantId: i.variantId,
        sku: i.variant.sku,
        titleEn: i.variant.product.titleEn,
        titleBn: i.variant.product.titleBn,
        optionsText: opts.map((o) => o.valueEn).join(', '),
        optionsTextBn: opts.map((o) => o.valueBn ?? o.valueEn).join(', '),
        qty: i.qty,
        unitPriceP: i.unitPriceP,
        lineTotalP: i.lineTotalP,
      };
    }),
  };
}

type Line = { variantId: string; qty: number };

/**
 * Stock model for SR sales (R13), all through InventoryService.move:
 *   submit            sr_reserve  reserved +qty            (checked: reserved <= on_hand)
 *   reject / cancel   sr_release  reserved -qty            (only while submitted)
 *   approve           no stock change; writes the sale_due ledger row
 *   deliver           sr_ship     on_hand -qty, reserved -qty
 *   reverse           approved: sr_release; delivered: return_restock (on_hand +qty)
 */
@Injectable()
export class SrSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly ledger: B2bLedgerService,
  ) {}

  async create(srStaffId: string, dto: SrCreateSaleDto): Promise<SrSaleDetailView> {
    const ids = dto.items.map((i) => i.variantId);
    if (new Set(ids).size !== ids.length) {
      throw srError(BadRequestException, 'DUPLICATE_VARIANT', 'Each variant can appear only once');
    }
    const lines = dto.items.map((i) => ({ ...i, lineTotalP: i.qty * i.unitPriceP }));
    const totalP = lines.reduce((sum, l) => sum + l.lineTotalP, 0);
    if (lines.some((l) => l.lineTotalP > MAX_MONEY_P) || totalP > MAX_MONEY_P) {
      throw srError(BadRequestException, 'TOTAL_TOO_LARGE', 'Sale total is too large');
    }
    if (dto.paidAtSaleP > totalP) {
      throw srError(
        BadRequestException,
        'PAID_EXCEEDS_TOTAL',
        'Paid amount is more than the total',
      );
    }

    const now = new Date();
    const saleId = await this.prisma.$transaction(async (tx) => {
      const shop = await tx.b2bShop.findUnique({
        where: { id: dto.b2bShopId },
        select: { status: true },
      });
      if (!shop) throw new NotFoundException('Shop not found');
      if (shop.status === 'blocked') {
        throw srError(ConflictException, 'SHOP_BLOCKED', 'This shop is blocked');
      }

      const variants = await tx.variant.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          sku: true,
          isActive: true,
          product: { select: { status: true, fulfillment: true } },
        },
      });
      const variantById = new Map(variants.map((v) => [v.id, v]));
      for (const id of ids) {
        const v = variantById.get(id);
        const sellable =
          v?.isActive && v.product.status === 'active' && v.product.fulfillment === 'stock';
        if (!sellable) {
          throw srError(
            BadRequestException,
            'VARIANT_UNAVAILABLE',
            `Product ${v?.sku ?? id} cannot be sold`,
          );
        }
      }

      const [{ n } = { n: 0n }] = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT nextval('sr_memo_no_seq') AS n`;
      const sale = await tx.srSale.create({
        data: {
          memoNo: memoNumber(now, n),
          srStaffId,
          b2bShopId: dto.b2bShopId,
          totalP,
          paidAtSaleP: dto.paidAtSaleP,
          dueP: totalP - dto.paidAtSaleP,
          deliveryBy: dto.deliveryBy,
          note: dto.note ?? null,
          submittedAt: now,
          items: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              qty: l.qty,
              unitPriceP: l.unitPriceP,
              lineTotalP: l.lineTotalP,
            })),
          },
        },
        select: { id: true },
      });
      await this.stock(tx, lines, 'sr_reserve', 1, sale.id, srStaffId, variantById);
      return sale.id;
    });
    return this.detail(saleId);
  }

  /** SR cancels own sale while it is still submitted. */
  async cancel(srStaffId: string, id: string): Promise<SrSaleDetailView> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.srSale.findFirst({
        where: { id, srStaffId },
        select: { id: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      const done = await tx.srSale.updateMany({
        where: { id, status: 'submitted' },
        data: { status: 'cancelled' },
      });
      if (done.count === 0) this.notSubmitted();
      await this.release(tx, id, srStaffId);
    });
    return this.detail(id);
  }

  async reject(staffId: string, id: string, reason: string): Promise<SrSaleDetailView> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertExists(tx, id);
      const done = await tx.srSale.updateMany({
        where: { id, status: 'submitted' },
        data: { status: 'rejected', rejectedReason: reason },
      });
      if (done.count === 0) this.notSubmitted();
      await this.release(tx, id, staffId);
    });
    return this.detail(id);
  }

  async approve(staffId: string, id: string): Promise<SrSaleDetailView> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.srSale.findUnique({
        where: { id },
        select: { srStaffId: true, b2bShopId: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.srStaffId === staffId) {
        throw new ForbiddenException('You cannot approve your own sale');
      }
      const done = await tx.srSale.updateMany({
        where: { id, status: 'submitted' },
        data: { status: 'approved', approvedById: staffId, approvedAt: new Date() },
      });
      if (done.count === 0) this.notSubmitted();

      const shop = await this.ledger.lockShop(tx, sale.b2bShopId);
      if (shop.status === 'blocked') {
        throw srError(ConflictException, 'SHOP_BLOCKED', 'This shop is blocked');
      }
      const { dueP, memoNo } = await tx.srSale.findUniqueOrThrow({
        where: { id },
        select: { dueP: true, memoNo: true },
      });
      // Payment at sale lives on the sale; only the unpaid rest becomes ledger due.
      if (dueP > 0) {
        await this.ledger.append(tx, {
          shopId: sale.b2bShopId,
          type: 'sale_due',
          amountP: dueP,
          recordedById: sale.srStaffId,
          confirmedById: staffId,
          srSaleId: id,
          note: memoNo,
        });
      }
    });
    return this.detail(id);
  }

  /**
   * Goods left the warehouse (R19): reserved stock becomes shipped. Staff can mark any approved
   * sale; an SR only their own sale that they chose to deliver themselves (C42).
   */
  async deliver(staffId: string, id: string, asSr = false): Promise<SrSaleDetailView> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.srSale.findFirst({
        where: asSr ? { id, srStaffId: staffId } : { id },
        select: { deliveryBy: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (asSr && sale.deliveryBy !== 'sr') {
        throw srError(ForbiddenException, 'DELIVERY_BY_STAFF', 'Staff deliver this sale');
      }
      const done = await tx.srSale.updateMany({
        where: { id, status: 'approved' },
        data: { status: 'delivered', deliveredById: staffId, deliveredAt: new Date() },
      });
      if (done.count === 0) {
        throw srError(ConflictException, 'INVALID_STATE', 'Only approved sales can be delivered');
      }
      const items = await tx.srSaleItem.findMany({ where: { srSaleId: id } });
      await this.stock(tx, items, 'sr_ship', -1, id, staffId);
    });
    return this.detail(id);
  }

  /**
   * Staff undoes an approved or delivered sale (C43). The sale's due is cancelled with a
   * `reversal` ledger row; money already collected stays as collections, so an over-paid shop
   * simply shows a negative due (credit). Stock: approved -> sr_release; delivered -> the goods
   * come back on hand as `return_restock`.
   */
  async reverse(staffId: string, id: string, reason: string): Promise<SrSaleDetailView> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.srSale.findUnique({
        where: { id },
        select: { status: true, srStaffId: true, b2bShopId: true, memoNo: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status !== 'approved' && sale.status !== 'delivered') {
        throw srError(
          ConflictException,
          'INVALID_STATE',
          'Only approved or delivered sales can be reversed',
        );
      }
      const done = await tx.srSale.updateMany({
        where: { id, status: sale.status },
        data: {
          status: 'reversed',
          reversedById: staffId,
          reversedAt: new Date(),
          reverseReason: reason,
        },
      });
      if (done.count === 0) {
        throw srError(ConflictException, 'INVALID_STATE', 'The sale was changed meanwhile');
      }

      await this.ledger.lockShop(tx, sale.b2bShopId);
      const due = await tx.b2bLedger.findFirst({
        where: { srSaleId: id, type: 'sale_due' },
        select: { amountP: true },
      });
      if (due) {
        await this.ledger.append(tx, {
          shopId: sale.b2bShopId,
          type: 'reversal',
          amountP: -due.amountP,
          recordedById: sale.srStaffId,
          confirmedById: staffId,
          srSaleId: id,
          note: `${sale.memoNo}: ${reason}`,
        });
      }

      const items = await tx.srSaleItem.findMany({ where: { srSaleId: id } });
      if (sale.status === 'approved') await this.stock(tx, items, 'sr_release', -1, id, staffId);
      else await this.restock(tx, items, id, staffId);
    });
    return this.detail(id);
  }

  async portalList(srStaffId: string, q: SrSalesQueryDto) {
    return this.list({ srStaffId, ...(q.status && { status: q.status }) }, q.page, q.pageSize);
  }

  async portalGet(srStaffId: string, id: string): Promise<SrSaleDetailView> {
    const row = await this.prisma.srSale.findFirst({
      where: { id, srStaffId },
      include: saleDetailInclude,
    });
    if (!row) throw new NotFoundException('Sale not found');
    return toDetailView(row);
  }

  async adminList(q: SrAdminSalesQueryDto) {
    const where: Prisma.SrSaleWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.srId) where.srStaffId = q.srId;
    if (q.shopId) where.b2bShopId = q.shopId;
    return this.list(where, q.page, q.pageSize);
  }

  async detail(id: string): Promise<SrSaleDetailView> {
    const row = await this.prisma.srSale.findUnique({
      where: { id },
      include: saleDetailInclude,
    });
    if (!row) throw new NotFoundException('Sale not found');
    return toDetailView(row);
  }

  private async list(where: Prisma.SrSaleWhereInput, page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.srSale.count({ where }),
      this.prisma.srSale.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: listInclude,
      }),
    ]);
    return { items: rows.map(toListView), total, page, pageSize };
  }

  private async restock(
    tx: Prisma.TransactionClient,
    lines: Line[],
    saleId: string,
    staffId: string,
  ) {
    const sorted = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const l of sorted) {
      await this.inventory.move(tx, {
        variantId: l.variantId,
        qtyDelta: l.qty,
        reservedDelta: 0,
        reason: 'return_restock',
        refType: 'sr_sale',
        refId: saleId,
        staffId,
        note: 'SR sale reversed',
      });
    }
  }

  private notSubmitted(): never {
    throw srError(ConflictException, 'INVALID_STATE', 'Only submitted sales can be changed');
  }

  private async assertExists(tx: Prisma.TransactionClient, id: string) {
    const found = await tx.srSale.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Sale not found');
  }

  private async release(tx: Prisma.TransactionClient, saleId: string, staffId: string) {
    const items = await tx.srSaleItem.findMany({ where: { srSaleId: saleId } });
    await this.stock(tx, items, 'sr_release', -1, saleId, staffId);
  }

  /** sign +1 reserves, -1 releases (reserve only) or ships (reserve and on-hand). */
  private async stock(
    tx: Prisma.TransactionClient,
    lines: Line[],
    reason: 'sr_reserve' | 'sr_release' | 'sr_ship',
    sign: 1 | -1,
    saleId: string,
    staffId: string,
    skus?: Map<string, { sku: string }>,
  ) {
    // Fixed order so concurrent sales lock inventory rows consistently.
    const sorted = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const l of sorted) {
      try {
        await this.inventory.move(tx, {
          variantId: l.variantId,
          qtyDelta: reason === 'sr_ship' ? sign * l.qty : 0,
          reservedDelta: sign * l.qty,
          reason,
          refType: 'sr_sale',
          refId: saleId,
          staffId,
        });
      } catch (e) {
        if (e instanceof ConflictException) {
          const sku = skus?.get(l.variantId)?.sku ?? l.variantId;
          throw srError(ConflictException, 'OUT_OF_STOCK', `Not enough stock for ${sku}`);
        }
        throw e;
      }
    }
  }
}
