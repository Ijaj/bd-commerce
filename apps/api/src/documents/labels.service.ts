import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DocumentsError } from './documents.errors';

@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async one(id: string) {
    const [label] = await this.many([id]);
    return label as NonNullable<typeof label>;
  }

  /** Same order as `ids` (duplicates dropped); any unknown id fails the whole batch. */
  async many(ids: string[]) {
    const unique = [...new Set(ids)];
    const [rows, store] = await Promise.all([
      this.prisma.shipment.findMany({
        where: { id: { in: unique } },
        include: {
          courier: { select: { code: true, name: true } },
          order: true,
          items: { include: { orderItem: true }, orderBy: { id: 'asc' } },
        },
      }),
      this.settings.get('store_info'),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const missing = unique.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new DocumentsError(HttpStatus.NOT_FOUND, 'SHIPMENT_NOT_FOUND', 'Shipment not found', {
        missing,
      });
    }
    const printedAt = new Date().toISOString();
    return unique.map((id) => {
      const s = byId.get(id) as NonNullable<ReturnType<typeof byId.get>>;
      return {
        shipmentNo: s.shipmentNo,
        orderNo: s.order.orderNo,
        barcodeValue: s.consignmentId ?? s.shipmentNo,
        courier: s.courier,
        consignmentId: s.consignmentId,
        store: { name: store.name, phone: store.phone },
        to: {
          name: s.order.shipName,
          phone: s.order.shipPhone,
          address: [s.order.shipLine, s.order.shipLandmark].filter(Boolean).join(', '),
          placeText: s.order.shipPlaceText,
        },
        codAmountP: s.codAmountP,
        weightG: s.weightG,
        itemsText: s.items
          .map((i) => `${i.qty}× ${i.orderItem.titleSnapshot} (${i.orderItem.sku})`)
          .join(', '),
        note: s.note,
        printedAt,
      };
    });
  }
}
