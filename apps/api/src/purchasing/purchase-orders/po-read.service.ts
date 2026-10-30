import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import type { PoListQueryDto, PoVariantOptionsQueryDto } from './po.dto';
import { PoError } from './po.errors';
import { dateOnly, dhakaToday, OPTION_INCLUDE, optionLabels } from './po.util';

const OPEN = ['sent', 'partially_received'];
const STATUSES = [
  'draft',
  'sent',
  'partially_received',
  'received',
  'closed',
  'cancelled',
] as const;

type SummaryRow = Prisma.PurchaseOrderGetPayload<{
  include: {
    supplier: { select: { id: true; name: true } };
    items: { select: { qtyOrdered: true; qtyReceived: true; qtyRejected: true; unitCostP: true } };
  };
}>;

function summary(po: SummaryRow, today: string) {
  const expectedAt = dateOnly(po.expectedAt);
  const sum = (f: (i: SummaryRow['items'][number]) => number) =>
    po.items.reduce((a, i) => a + f(i), 0);
  return {
    id: po.id,
    poNo: po.poNo,
    supplier: { id: po.supplier.id, name: po.supplier.name },
    status: po.status,
    expectedAt,
    lineCount: po.items.length,
    qtyOrdered: sum((i) => i.qtyOrdered),
    qtyReceived: sum((i) => i.qtyReceived),
    qtyRejected: sum((i) => i.qtyRejected),
    subtotalP: po.subtotalP,
    receivedValueP: sum((i) => i.qtyReceived * i.unitCostP),
    late: expectedAt !== null && expectedAt < today && OPEN.includes(po.status),
    createdAt: po.createdAt.toISOString(),
    sentAt: po.sentAt?.toISOString() ?? null,
  };
}

const SUMMARY_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  items: { select: { qtyOrdered: true, qtyReceived: true, qtyRejected: true, unitCostP: true } },
} as const;

interface OptionRow {
  variant_id: string;
  product_id: string;
  title_en: string;
  sku: string;
  options: { en: string; bn: string | null }[];
  fulfillment: 'stock' | 'dropship';
  on_hand: number;
  linked: boolean;
  link_cost_p: number | null;
  last_cost_p: number | null;
  variant_cost_p: number | null;
}

@Injectable()
export class PoReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async list(q: PoListQueryDto) {
    const base: Prisma.PurchaseOrderWhereInput = {};
    if (q.supplierId) base.supplierId = q.supplierId;
    if (q.q) {
      base.OR = [
        { poNo: { contains: q.q, mode: 'insensitive' } },
        { supplier: { name: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    const where = q.status ? { ...base, status: q.status } : base;
    const [rows, total, grouped] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      (typeof STATUSES)[number],
      number
    >;
    for (const g of grouped) counts[g.status] = g._count._all;
    const all = STATUSES.reduce((a, s) => a + counts[s], 0);
    const today = dhakaToday();
    return { items: rows.map((r) => summary(r, today)), total, counts: { all, ...counts } };
  }

  async detail(id: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        ...SUMMARY_INCLUDE,
        supplier: { select: { id: true, name: true, phone: true, email: true, address: true } },
        createdBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });
    if (!po) throw new PoError(HttpStatus.NOT_FOUND, 'PO_NOT_FOUND', 'Purchase order not found');
    const [items, receipts] = await Promise.all([
      db.purchaseOrderItem.findMany({
        where: { poId: id },
        orderBy: { id: 'asc' },
        include: {
          variant: {
            include: {
              ...OPTION_INCLUDE,
              product: { select: { id: true, titleEn: true } },
              inventory: { select: { onHand: true } },
            },
          },
        },
      }),
      db.poReceipt.findMany({
        where: { poId: id },
        orderBy: [{ at: 'desc' }, { id: 'desc' }],
        include: {
          receivedBy: { select: { id: true, name: true } },
          items: {
            orderBy: { id: 'asc' },
            include: { poItem: { select: { variant: { select: { sku: true } } } } },
          },
        },
      }),
    ]);
    return {
      ...summary(po, dhakaToday()),
      supplier: po.supplier,
      notes: po.notes,
      closeReason: po.closeReason,
      closedAt: po.closedAt?.toISOString() ?? null,
      closedBy: po.closedBy,
      createdBy: po.createdBy,
      items: items.map((i) => ({
        id: i.id,
        variantId: i.variantId,
        productId: i.variant.product.id,
        productTitleEn: i.variant.product.titleEn,
        sku: i.variant.sku,
        options: optionLabels(i.variant),
        qtyOrdered: i.qtyOrdered,
        qtyReceived: i.qtyReceived,
        qtyRejected: i.qtyRejected,
        remaining: i.qtyOrdered - i.qtyReceived - i.qtyRejected,
        unitCostP: i.unitCostP,
        lineTotalP: i.qtyOrdered * i.unitCostP,
        onHand: i.variant.inventory?.onHand ?? 0,
        variantCostP: i.variant.costP,
      })),
      receipts: receipts.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        note: r.note,
        totalP: r.totalP,
        receivedBy: r.receivedBy,
        items: r.items.map((ri) => ({
          poItemId: ri.poItemId,
          sku: ri.poItem.variant.sku,
          qtyGood: ri.qtyGood,
          qtyRejected: ri.qtyRejected,
          unitCostP: ri.unitCostP,
          costBeforeP: ri.costBeforeP,
          costAfterP: ri.costAfterP,
        })),
      })),
    };
  }

  async print(id: string) {
    const d = await this.detail(id); // 404s for an unknown PO before anything else
    const [store, supplier] = await Promise.all([
      this.settings.get('store_info'),
      this.prisma.supplier.findUniqueOrThrow({
        where: { id: d.supplier.id },
        select: { name: true, contactName: true, phone: true, email: true, address: true },
      }),
    ]);
    return {
      store,
      supplier,
      po: {
        poNo: d.poNo,
        status: d.status,
        createdAt: d.createdAt,
        sentAt: d.sentAt,
        expectedAt: d.expectedAt,
        notes: d.notes,
        subtotalP: d.subtotalP,
      },
      items: d.items.map((i) => ({
        sku: i.sku,
        title: i.productTitleEn,
        options: i.options,
        qtyOrdered: i.qtyOrdered,
        unitCostP: i.unitCostP,
        lineTotalP: i.lineTotalP,
      })),
    };
  }

  /** Picker for PO lines (C74): variants linked to the supplier first, then any other match. */
  async variantOptions(q: PoVariantOptionsQueryDto) {
    const like = q.q ? `%${q.q.replace(/[\\%_]/g, '\\$&')}%` : null;
    const match = like
      ? Prisma.sql`AND (v.sku ILIKE ${like} OR p.title_en ILIKE ${like} OR p.title_bn ILIKE ${like})`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<OptionRow[]>`
      SELECT v.id AS variant_id, p.id AS product_id, p.title_en, v.sku,
        coalesce((
          SELECT json_agg(json_build_object('en', ov.value_en, 'bn', ov.value_bn) ORDER BY o.position)
          FROM product_option_values ov
          JOIN product_options o ON o.id = ov.option_id
          WHERE ov.id IN (v.option_value_1_id, v.option_value_2_id)), '[]'::json) AS options,
        p.fulfillment, coalesce(i.on_hand, 0) AS on_hand,
        (vs.id IS NOT NULL) AS linked, vs.cost_p AS link_cost_p,
        (SELECT poi.unit_cost_p FROM purchase_order_items poi
           JOIN purchase_orders po ON po.id = poi.po_id
          WHERE poi.variant_id = v.id AND po.supplier_id = ${q.supplierId}::uuid
            AND po.status <> 'cancelled'
          ORDER BY po.created_at DESC, po.id DESC LIMIT 1) AS last_cost_p,
        v.cost_p AS variant_cost_p
      FROM variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN inventory i ON i.variant_id = v.id
      LEFT JOIN variant_suppliers vs ON vs.variant_id = v.id AND vs.supplier_id = ${q.supplierId}::uuid
      WHERE v.is_active ${match}
      ORDER BY (vs.id IS NOT NULL) DESC, p.title_en, v.sort, v.sku
      LIMIT ${q.limit}`;
    return rows.map((r) => ({
      variantId: r.variant_id,
      productId: r.product_id,
      productTitleEn: r.title_en,
      sku: r.sku,
      options: r.options,
      fulfillment: r.fulfillment,
      onHand: r.on_hand,
      linked: r.linked,
      lastCostP: r.link_cost_p ?? r.last_cost_p ?? null,
      variantCostP: r.variant_cost_p,
    }));
  }
}
