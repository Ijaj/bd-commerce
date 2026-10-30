import { HttpStatus, Injectable } from '@nestjs/common';
import { InventoryService } from '../../inventory/inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { PoReceiveDto } from './po.dto';
import { PoError } from './po.errors';
import { lockPo } from './po.service';
import { weightedAverageCost } from './po.util';
import { PoReadService } from './po-read.service';

/**
 * Goods receiving (C64, C71, C72). One transaction per receipt: PO row lock, then per line the
 * inventory row lock (in variant order, so two receipts sharing variants cannot deadlock),
 * weighted-average cost, stock, receipt rows and the payable.
 */
@Injectable()
export class PoReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly read: PoReadService,
  ) {}

  async receive(staffId: string, id: string, dto: PoReceiveDto) {
    await this.prisma.$transaction(
      async (tx) => {
        const po = await lockPo(tx, id);
        if (po.status !== 'sent' && po.status !== 'partially_received') {
          throw new PoError(
            HttpStatus.CONFLICT,
            'PO_BAD_STATUS',
            'Only a sent or partly received PO can be received',
          );
        }
        const items = await tx.purchaseOrderItem.findMany({ where: { poId: id } });
        const byId = new Map(items.map((i) => [i.id, i]));

        const lines = dto.items.filter((l) => l.qtyGood > 0 || l.qtyRejected > 0);
        if (lines.length === 0) {
          throw new PoError(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'PO_NOTHING_RECEIVED',
            'Enter a received or rejected quantity',
          );
        }
        for (const l of dto.items) {
          const item = byId.get(l.poItemId);
          if (!item) {
            throw new PoError(HttpStatus.NOT_FOUND, 'PO_ITEM_NOT_FOUND', 'Line not on this PO', {
              poItemId: l.poItemId,
            });
          }
          const remaining = item.qtyOrdered - item.qtyReceived - item.qtyRejected;
          if (l.qtyGood + l.qtyRejected > remaining) {
            throw new PoError(
              HttpStatus.CONFLICT,
              'PO_OVER_RECEIVE',
              `Only ${remaining} left to receive on this line`,
              { poItemId: l.poItemId, remaining },
            );
          }
        }

        const totalP = lines.reduce(
          (a, l) => a + l.qtyGood * (byId.get(l.poItemId)?.unitCostP ?? 0),
          0,
        );
        const receipt = await tx.poReceipt.create({
          data: { poId: id, totalP, note: dto.note || null, receivedById: staffId },
        });

        const ordered = [...lines].sort((a, b) =>
          (byId.get(a.poItemId)?.variantId ?? '').localeCompare(
            byId.get(b.poItemId)?.variantId ?? '',
          ),
        );
        for (const l of ordered) {
          const item = byId.get(l.poItemId);
          if (!item) continue;
          let costBeforeP: number | null = null;
          let costAfterP: number | null = null;
          if (l.qtyGood > 0) {
            const onHand = await this.inventory.lockedOnHand(tx, item.variantId);
            const variant = await tx.variant.findUniqueOrThrow({
              where: { id: item.variantId },
              select: { costP: true },
            });
            costBeforeP = variant.costP;
            costAfterP = weightedAverageCost(variant.costP, onHand, l.qtyGood, item.unitCostP);
            if (costAfterP !== costBeforeP) {
              await tx.variant.update({
                where: { id: item.variantId },
                data: { costP: costAfterP },
              });
            }
            await this.inventory.move(tx, {
              variantId: item.variantId,
              qtyDelta: l.qtyGood,
              reservedDelta: 0,
              reason: 'po_receive',
              refType: 'po_receipt',
              refId: receipt.id,
              staffId,
            });
          }
          await tx.poReceiptItem.create({
            data: {
              receiptId: receipt.id,
              poItemId: item.id,
              qtyGood: l.qtyGood,
              qtyRejected: l.qtyRejected,
              unitCostP: item.unitCostP,
              costBeforeP,
              costAfterP,
            },
          });
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: {
              qtyReceived: { increment: l.qtyGood },
              qtyRejected: { increment: l.qtyRejected },
            },
          });
          item.qtyReceived += l.qtyGood;
          item.qtyRejected += l.qtyRejected;
        }

        if (totalP > 0) {
          await tx.supplierLedger.create({
            data: {
              supplierId: po.supplierId,
              type: 'receipt',
              amountP: totalP,
              poReceiptId: receipt.id,
              recordedById: staffId,
            },
          });
        }
        const done = items.every((i) => i.qtyReceived + i.qtyRejected === i.qtyOrdered);
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: done ? 'received' : 'partially_received' },
        });
      },
      { timeout: 30_000 },
    );
    return this.read.detail(id);
  }
}
