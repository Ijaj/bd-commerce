import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { PoStatus, Prisma } from '../../generated/prisma/client';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { upsertSupplierLink } from '../suppliers/supplier-links';
import type { PoCancelDto, PoCloseDto, PoCreateDto, PoPatchDto } from './po.dto';
import { PoError } from './po.errors';
import { dhakaYymm, toDate } from './po.util';
import { poMail } from './po-mail';
import { PoReadService } from './po-read.service';

type Line = PoCreateDto['items'][number];

/** Locks the PO row for the rest of the transaction; every state change starts here. */
export async function lockPo(tx: Prisma.TransactionClient, id: string) {
  const [row] = await tx.$queryRaw<{ status: PoStatus; supplier_id: string }[]>`
    SELECT status, supplier_id FROM purchase_orders WHERE id = ${id}::uuid FOR UPDATE`;
  if (!row) throw new PoError(HttpStatus.NOT_FOUND, 'PO_NOT_FOUND', 'Purchase order not found');
  return { status: row.status, supplierId: row.supplier_id };
}

@Injectable()
export class PoService {
  private readonly logger = new Logger(PoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly read: PoReadService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
  ) {}

  async create(staffId: string, dto: PoCreateDto) {
    const id = await this.prisma.$transaction(
      async (tx) => {
        await this.assertSupplier(tx, dto.supplierId);
        await this.assertLines(tx, dto.items);
        const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('po_no_seq') AS n`;
        const poNo = `PO-${dhakaYymm(new Date())}-${String(seq[0]?.n ?? 0n).padStart(5, '0')}`;
        const po = await tx.purchaseOrder.create({
          data: {
            poNo,
            supplierId: dto.supplierId,
            expectedAt: toDate(dto.expectedAt),
            notes: dto.notes || null,
            createdById: staffId,
            subtotalP: subtotal(dto.items),
            items: { create: dto.items },
          },
        });
        await this.linkLines(tx, dto.supplierId, dto.items);
        return po.id;
      },
      { timeout: 20_000 },
    );
    return this.read.detail(id);
  }

  async patch(id: string, dto: PoPatchDto) {
    await this.prisma.$transaction(
      async (tx) => {
        const po = await lockPo(tx, id);
        if (po.status === 'draft') {
          const supplierId = dto.supplierId ?? po.supplierId;
          if (dto.supplierId && dto.supplierId !== po.supplierId) {
            await this.assertSupplier(tx, dto.supplierId);
          }
          const data: Prisma.PurchaseOrderUncheckedUpdateInput = { supplierId };
          if (dto.expectedAt !== undefined) data.expectedAt = toDate(dto.expectedAt);
          if (dto.notes !== undefined) data.notes = dto.notes || null;
          if (dto.items) {
            await this.assertLines(tx, dto.items);
            await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
            await tx.purchaseOrderItem.createMany({
              data: dto.items.map((i) => ({ ...i, poId: id })),
            });
            data.subtotalP = subtotal(dto.items);
          }
          await tx.purchaseOrder.update({ where: { id }, data });
          if (dto.items) await this.linkLines(tx, supplierId, dto.items);
          else if (dto.supplierId && dto.supplierId !== po.supplierId) {
            const items = await tx.purchaseOrderItem.findMany({ where: { poId: id } });
            await this.linkLines(tx, supplierId, items);
          }
          return;
        }
        if (po.status === 'sent' || po.status === 'partially_received') {
          if (dto.supplierId !== undefined || dto.items !== undefined) throw locked();
          const data: Prisma.PurchaseOrderUncheckedUpdateInput = {};
          if (dto.expectedAt !== undefined) data.expectedAt = toDate(dto.expectedAt);
          if (dto.notes !== undefined) data.notes = dto.notes || null;
          await tx.purchaseOrder.update({ where: { id }, data });
          return;
        }
        throw locked();
      },
      { timeout: 20_000 },
    );
    return this.read.detail(id);
  }

  async send(id: string) {
    const supplierEmail = await this.prisma.$transaction(async (tx) => {
      const po = await lockPo(tx, id);
      if (po.status !== 'draft') throw badStatus('Only a draft can be sent');
      const lines = await tx.purchaseOrderItem.count({ where: { poId: id } });
      if (lines === 0) {
        throw new PoError(HttpStatus.UNPROCESSABLE_ENTITY, 'PO_EMPTY', 'Add at least one line');
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'sent', sentAt: new Date() },
      });
      const s = await tx.supplier.findUniqueOrThrow({
        where: { id: po.supplierId },
        select: { email: true },
      });
      return s.email?.trim() || null;
    });
    const detail = await this.read.detail(id);
    let emailed = false;
    if (supplierEmail) {
      try {
        const store = await this.settings.get('store_info');
        this.mail.send(poMail(supplierEmail, store.name, detail));
        emailed = true;
      } catch (err) {
        this.logger.error(`PO ${detail.poNo} email failed: ${String(err)}`);
      }
    }
    return { po: detail, emailed };
  }

  /** Closes a partly received PO short (C71): the rest is dropped and nothing is owed for it. */
  async close(staffId: string, id: string, dto: PoCloseDto) {
    await this.prisma.$transaction(async (tx) => {
      const po = await lockPo(tx, id);
      if (po.status !== 'partially_received') {
        throw badStatus('Only a partly received PO can be closed short');
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closedById: staffId,
          closeReason: dto.reason,
        },
      });
    });
    return this.read.detail(id);
  }

  async cancel(staffId: string, id: string, dto: PoCancelDto) {
    await this.prisma.$transaction(async (tx) => {
      const po = await lockPo(tx, id);
      const receipts = po.status === 'sent' ? await tx.poReceipt.count({ where: { poId: id } }) : 0;
      if ((po.status !== 'draft' && po.status !== 'sent') || receipts > 0) {
        throw badStatus('Only a draft, or a sent PO with nothing received, can be cancelled');
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'cancelled',
          closedAt: new Date(),
          closedById: staffId,
          closeReason: dto.reason ?? null,
        },
      });
    });
    return this.read.detail(id);
  }

  private async assertSupplier(tx: Prisma.TransactionClient, supplierId: string) {
    const s = await tx.supplier.findUnique({
      where: { id: supplierId },
      select: { isActive: true },
    });
    if (!s) throw new PoError(HttpStatus.NOT_FOUND, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    if (!s.isActive) {
      throw new PoError(HttpStatus.CONFLICT, 'SUPPLIER_INACTIVE', 'Supplier is inactive');
    }
  }

  private async assertLines(tx: Prisma.TransactionClient, items: Line[]) {
    const variants = await tx.variant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      select: { id: true, sku: true, product: { select: { fulfillment: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    for (const i of items) {
      const v = byId.get(i.variantId);
      if (!v) {
        throw new PoError(HttpStatus.NOT_FOUND, 'VARIANT_NOT_FOUND', 'Variant not found', {
          variantId: i.variantId,
        });
      }
      if (v.product.fulfillment === 'dropship') {
        throw new PoError(
          HttpStatus.CONFLICT,
          'PO_DROPSHIP_VARIANT',
          `${v.sku} is a dropship product and cannot be purchased into stock`,
          { variantId: v.id },
        );
      }
    }
  }

  private async linkLines(tx: Prisma.TransactionClient, supplierId: string, items: Line[]) {
    for (const i of items) await upsertSupplierLink(tx, supplierId, i.variantId, i.unitCostP);
  }
}

const subtotal = (items: Line[]) => items.reduce((a, i) => a + i.qtyOrdered * i.unitCostP, 0);
const locked = () =>
  new PoError(HttpStatus.CONFLICT, 'PO_LOCKED', 'This purchase order can no longer be edited');
const badStatus = (message: string) => new PoError(HttpStatus.CONFLICT, 'PO_BAD_STATUS', message);
