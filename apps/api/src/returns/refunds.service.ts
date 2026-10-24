import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma, RefundMethod, RefundStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type {
  ReturnOrderRefundDto,
  ReturnRefundDetailDto,
  ReturnRefundDto,
  ReturnRefundListDto,
  ReturnRefundListQueryDto,
} from './returns.dto';
import { ReturnError } from './returns.errors';
import { lineRefundP, lockOrder } from './returns.util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Refunds that still reserve part of what the customer paid. */
const LIVE: RefundStatus[] = ['pending_approval', 'approved', 'processing', 'done'];
/** Not yet done: counted against the cap but not yet in order.refundedP. */
const OUTSTANDING: RefundStatus[] = ['pending_approval', 'approved', 'processing'];

type RefundRow = Prisma.RefundGetPayload<{ include: { items: true } }>;

interface NewRefund {
  returnId: string | null;
  items: { orderItemId: string; qty: number; amountP: number }[];
  amountP: number;
  method: RefundMethod;
  note: string | null;
  staffId: string;
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ---- creation -------------------------------------------------------------------------------

  /** Refund for the lines of an inspected return, minus return shipping when the customer is at fault. */
  async createForReturn(staffId: string, returnId: string, dto: ReturnRefundDto) {
    const threshold = (await this.settings.get('returns')).refundApprovalAboveP;
    const id = await this.prisma.$transaction(async (tx) => {
      const probe = await tx.return.findUnique({
        where: { id: returnId },
        select: { orderId: true },
      });
      if (!probe) {
        throw new ReturnError(HttpStatus.NOT_FOUND, 'RETURN_NOT_FOUND', 'Return not found.');
      }
      await lockOrder(tx, probe.orderId);
      const ret = await tx.return.findUniqueOrThrow({
        where: { id: returnId },
        include: { order: true, items: { include: { orderItem: true } } },
      });
      if (ret.status !== 'inspected' && ret.status !== 'closed') {
        throw new ReturnError(
          HttpStatus.CONFLICT,
          'RETURN_BAD_STATE',
          'Inspect the return before refunding it.',
          { status: ret.status },
        );
      }
      const existing = await tx.refund.count({
        where: { returnId, status: { in: LIVE } },
      });
      if (existing > 0) {
        throw new ReturnError(
          HttpStatus.CONFLICT,
          'REFUND_EXISTS',
          'This return already has a refund.',
        );
      }
      const items = ret.items.map((i) => ({
        orderItemId: i.orderItemId,
        qty: i.qty,
        amountP: lineRefundP(ret.order, i.orderItem.unitPriceP, i.qty),
      }));
      const lines = items.reduce((s, i) => s + i.amountP, 0);
      const deduction = ret.fault === 'customer' ? ret.returnShippingP : 0;
      return this.insert(tx, ret.order, threshold, {
        returnId,
        items,
        amountP: lines - deduction,
        method: dto.method,
        note: dto.note ?? null,
        staffId,
      });
    });
    return this.detail(id);
  }

  /** Cancel / goodwill refund with no return: by lines (pro-rata) and/or an explicit amount. */
  async createForOrder(staffId: string, orderRef: string, dto: ReturnOrderRefundDto) {
    if (!dto.items?.length && dto.amountP === undefined) {
      throw new ReturnError(
        HttpStatus.BAD_REQUEST,
        'REFUND_INVALID',
        'Give the lines to refund or an amount.',
      );
    }
    const threshold = (await this.settings.get('returns')).refundApprovalAboveP;
    const id = await this.prisma.$transaction(async (tx) => {
      const probe = await tx.order.findUnique({
        where: UUID_RE.test(orderRef) ? { id: orderRef } : { orderNo: orderRef },
        select: { id: true },
      });
      if (!probe) {
        throw new ReturnError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
      }
      await lockOrder(tx, probe.id);
      const order = await tx.order.findUniqueOrThrow({
        where: { id: probe.id },
        include: { items: true },
      });
      const byId = new Map(order.items.map((i) => [i.id, i]));
      const wanted = dto.items ?? [];
      if (new Set(wanted.map((i) => i.orderItemId)).size !== wanted.length) {
        throw new ReturnError(HttpStatus.BAD_REQUEST, 'REFUND_INVALID', 'List each line once.');
      }
      const items: NewRefund['items'] = [];
      for (const w of wanted) {
        const line = byId.get(w.orderItemId);
        if (!line) {
          throw new ReturnError(
            HttpStatus.BAD_REQUEST,
            'REFUND_INVALID',
            'Line does not belong to this order.',
          );
        }
        items.push({
          orderItemId: line.id,
          qty: w.qty,
          amountP: lineRefundP(order, line.unitPriceP, w.qty),
        });
      }
      const amountP = dto.amountP ?? items.reduce((s, i) => s + i.amountP, 0);
      return this.insert(tx, order, threshold, {
        returnId: null,
        items,
        amountP,
        method: dto.method,
        note: dto.note,
        staffId,
      });
    });
    return this.detail(id);
  }

  private async insert(
    tx: Prisma.TransactionClient,
    order: { id: string; paidP: number; refundedP: number },
    threshold: number,
    r: NewRefund,
  ) {
    if (r.amountP <= 0) {
      throw new ReturnError(
        HttpStatus.BAD_REQUEST,
        'REFUND_INVALID',
        'Refund amount must be more than zero.',
      );
    }
    const outstanding = await tx.refund.aggregate({
      where: { orderId: order.id, status: { in: OUTSTANDING } },
      _sum: { amountP: true },
    });
    const room = order.paidP - order.refundedP - (outstanding._sum.amountP ?? 0);
    if (r.amountP > room) {
      throw new ReturnError(
        HttpStatus.CONFLICT,
        'REFUND_EXCEEDS_PAID',
        'Refund is more than what the customer paid and has not had refunded yet.',
        { maxAmountP: Math.max(0, room) },
      );
    }
    // A line can't be refunded for more units than were ordered, across all live refunds.
    for (const it of r.items) {
      const done = await tx.refundItem.aggregate({
        where: { orderItemId: it.orderItemId, refund: { status: { in: LIVE } } },
        _sum: { qty: true },
      });
      const line = await tx.orderItem.findUniqueOrThrow({
        where: { id: it.orderItemId },
        select: { qty: true },
      });
      if ((done._sum.qty ?? 0) + it.qty > line.qty) {
        throw new ReturnError(
          HttpStatus.CONFLICT,
          'REFUND_INVALID',
          'More units refunded than were ordered.',
          { orderItemId: it.orderItemId },
        );
      }
    }
    const needsApproval = r.amountP > threshold;
    const created = await tx.refund.create({
      data: {
        orderId: order.id,
        returnId: r.returnId,
        amountP: r.amountP,
        method: r.method,
        status: needsApproval ? 'pending_approval' : 'approved',
        needsApproval,
        requestedBy: r.staffId,
        note: r.note,
        items: { create: r.items },
      },
      select: { id: true },
    });
    return created.id;
  }

  // ---- workflow -------------------------------------------------------------------------------

  async approve(staffId: string, id: string) {
    const refund = await this.mustFind(id);
    if (refund.requestedBy === staffId) {
      throw new ReturnError(
        HttpStatus.CONFLICT,
        'SAME_STAFF',
        'A different staff member must approve this refund.',
      );
    }
    await this.cas(id, ['pending_approval'], {
      status: 'approved',
      approvedBy: staffId,
      approvedAt: new Date(),
    });
    return this.detail(id);
  }

  async reject(staffId: string, id: string, reason: string) {
    const refund = await this.mustFind(id);
    await this.cas(id, ['pending_approval', 'approved'], {
      status: 'rejected',
      approvedBy: staffId,
      approvedAt: new Date(),
      note: refund.note ? `${refund.note}\nRejected: ${reason}` : `Rejected: ${reason}`,
    });
    return this.detail(id);
  }

  /** Staff confirm the money went back. Wallet refunds are only recorded: the wallet ledger arrives in step 8. */
  async complete(staffId: string, id: string, providerRef?: string) {
    await this.prisma.$transaction(async (tx) => {
      const probe = await tx.refund.findUnique({ where: { id }, select: { orderId: true } });
      if (!probe) {
        throw new ReturnError(HttpStatus.NOT_FOUND, 'REFUND_NOT_FOUND', 'Refund not found.');
      }
      await lockOrder(tx, probe.orderId);
      const refund = await tx.refund.findUniqueOrThrow({ where: { id } });
      if (refund.status !== 'approved') this.badState(refund.status, ['approved']);
      const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId } });
      const refundedP = order.refundedP + refund.amountP;
      if (refundedP > order.paidP) {
        throw new ReturnError(
          HttpStatus.CONFLICT,
          'REFUND_EXCEEDS_PAID',
          'Refunds would exceed what the customer paid.',
        );
      }
      const walletNote =
        refund.method === 'wallet' ? 'Wallet credit not posted automatically (step 8).' : null;
      await tx.refund.update({
        where: { id },
        data: {
          status: 'done',
          doneAt: new Date(),
          providerRef: providerRef ?? null,
          approvedBy: refund.approvedBy ?? staffId,
          approvedAt: refund.approvedAt ?? new Date(),
          ...(walletNote
            ? { note: refund.note ? `${refund.note}\n${walletNote}` : walletNote }
            : {}),
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          refundedP,
          paymentStatus: refundedP >= order.paidP ? 'refunded' : 'partially_refunded',
        },
      });
    });
    return this.detail(id);
  }

  private async cas(id: string, from: RefundStatus[], data: Prisma.RefundUncheckedUpdateManyInput) {
    const r = await this.prisma.refund.updateMany({ where: { id, status: { in: from } }, data });
    if (r.count === 1) return;
    const row = await this.mustFind(id);
    this.badState(row.status, from);
  }

  private badState(status: RefundStatus, allowed: RefundStatus[]): never {
    throw new ReturnError(
      HttpStatus.CONFLICT,
      'REFUND_BAD_STATE',
      `Refund is ${status}; this action needs ${allowed.join(' or ')}.`,
      { status },
    );
  }

  private async mustFind(id: string) {
    const row = await this.prisma.refund.findUnique({ where: { id } });
    if (!row) throw new ReturnError(HttpStatus.NOT_FOUND, 'REFUND_NOT_FOUND', 'Refund not found.');
    return row;
  }

  // ---- reads ----------------------------------------------------------------------------------

  async detail(id: string): Promise<ReturnRefundDetailDto> {
    const row = await this.prisma.refund.findUnique({ where: { id }, include: { items: true } });
    if (!row) throw new ReturnError(HttpStatus.NOT_FOUND, 'REFUND_NOT_FOUND', 'Refund not found.');
    return (await this.rows([row]))[0] as ReturnRefundDetailDto;
  }

  async forReturn(returnId: string) {
    const rows = await this.prisma.refund.findMany({
      where: { returnId },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.rows(rows);
  }

  async list(q: ReturnRefundListQueryDto): Promise<ReturnRefundListDto> {
    const where: Prisma.RefundWhereInput = q.status ? { status: q.status } : {};
    const [total, found] = await Promise.all([
      this.prisma.refund.count({ where }),
      this.prisma.refund.findMany({
        where,
        include: { items: true, order: { select: { orderNo: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    const rows = await this.rows(found);
    return {
      items: rows.map((r, i) => ({ ...r, orderNo: found[i]?.order.orderNo ?? '' })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  private async rows(refunds: RefundRow[]): Promise<ReturnRefundDetailDto[]> {
    const ids = [
      ...new Set(
        refunds.flatMap((r) => [r.requestedBy, r.approvedBy]).filter((x): x is string => !!x),
      ),
    ];
    const staff = ids.length
      ? await this.prisma.staff.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const name = new Map(staff.map((s) => [s.id, s.name]));
    return refunds.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      returnId: r.returnId,
      amountP: r.amountP,
      method: r.method,
      status: r.status,
      needsApproval: r.needsApproval,
      requestedBy: r.requestedBy,
      requestedByName: r.requestedBy ? (name.get(r.requestedBy) ?? null) : null,
      approvedBy: r.approvedBy,
      approvedByName: r.approvedBy ? (name.get(r.approvedBy) ?? null) : null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      providerRef: r.providerRef,
      note: r.note,
      doneAt: r.doneAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      items: r.items.map((i) => ({ orderItemId: i.orderItemId, qty: i.qty, amountP: i.amountP })),
    }));
  }
}
