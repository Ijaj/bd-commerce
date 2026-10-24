import { HttpStatus, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { Invoice, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { invoiceSnapshot } from './documents.dto';
import { DocumentsError } from './documents.errors';

export type InvoiceSnapshot = z.infer<typeof invoiceSnapshot>;

/** Order statuses where a customer may fetch the invoice on demand. */
const SENT = ['handed_over', 'in_transit', 'delivered', 'failed', 'returning', 'returned'] as const;

/** VAT is already inside the prices (Q95): the VAT portion of a gross amount. */
export function vatIncluded(grossP: number, rateBp: number) {
  return Math.round((grossP * rateBp) / (10_000 + rateBp));
}

function yymm(now: Date) {
  return `${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function invoiceView(inv: Invoice, orderNo: string, currentId: string) {
  return {
    id: inv.id,
    orderId: inv.orderId,
    orderNo,
    invoiceNo: inv.invoiceNo,
    issuedAt: inv.issuedAt.toISOString(),
    vatRateBp: inv.vatRateBp,
    vatTotalP: inv.vatTotalP,
    grandTotalP: inv.grandTotalP,
    bin: inv.binSnapshot,
    isCurrent: inv.id === currentId,
  };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Returns the order's current invoice, issuing the first one if none exists. Safe to call
   * repeatedly and concurrently. Pass `tx` to join the caller's transaction.
   */
  ensureIssued(orderId: string, tx?: Prisma.TransactionClient) {
    return this.issue(orderId, { reissue: false }, tx);
  }

  /** `reissue` always creates a new row (fresh snapshot); the previous invoice is kept. */
  async issue(orderId: string, opts: { reissue?: boolean } = {}, tx?: Prisma.TransactionClient) {
    const store = await this.settings.get('store_info');
    const run = async (db: Prisma.TransactionClient) => {
      // Serialises concurrent issuers of the same order so ensureIssued stays idempotent.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${orderId}`}))`;
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { items: { orderBy: { id: 'asc' } }, customer: true },
      });
      if (!order)
        throw new DocumentsError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found');
      if (!opts.reissue) {
        const existing = await db.invoice.findFirst({
          where: { orderId },
          orderBy: [{ issuedAt: 'desc' }, { invoiceNo: 'desc' }],
        });
        if (existing) return { invoice: existing, orderNo: order.orderNo };
      }
      if (order.status === 'cancelled') {
        throw new DocumentsError(
          HttpStatus.CONFLICT,
          'INVOICE_NOT_AVAILABLE',
          'A cancelled order cannot be invoiced',
        );
      }

      const now = new Date();
      const [{ n } = { n: 0n }] = await db.$queryRaw<{ n: bigint }[]>`
        SELECT nextval('invoice_no_seq') AS n`;
      const invoiceNo = `INV-${yymm(now)}-${String(n).padStart(5, '0')}`;
      const vatTotalP = vatIncluded(order.grandTotalP, store.vatRateBp);

      const snapshot: InvoiceSnapshot = {
        lang: order.lang,
        store: { ...store },
        orderNo: order.orderNo,
        orderDate: order.placedAt.toISOString(),
        paymentMethod: order.paymentMethodChosen,
        billTo: order.customer
          ? {
              name: order.customer.name,
              phone: order.customer.phone,
              email: order.customer.email,
            }
          : {
              name: order.guestName ?? order.shipName,
              phone: order.guestPhone,
              email: order.guestEmail,
            },
        shipTo: {
          name: order.shipName,
          phone: order.shipPhone,
          address: [order.shipLine, order.shipLandmark].filter(Boolean).join(', '),
          placeText: order.shipPlaceText,
        },
        lines: order.items
          .filter((i) => i.qty - i.qtyCancelled > 0)
          .map((i) => {
            const qty = i.qty - i.qtyCancelled;
            return {
              titleSnapshot: i.titleSnapshot,
              sku: i.sku,
              optionsText: i.optionsText,
              qty,
              unitPriceP: i.unitPriceP,
              // Keep the stored total for untouched lines so rounding at checkout is preserved.
              lineTotalP: i.qtyCancelled === 0 ? i.lineTotalP : i.unitPriceP * qty,
            };
          }),
        subtotalP: order.subtotalP,
        autoDiscountP: order.autoDiscountP,
        couponDiscountP: order.couponDiscountP,
        deliveryChargeP: order.deliveryChargeP,
        deliveryDiscountP: order.deliveryDiscountP,
        grandTotalP: order.grandTotalP,
        paidP: order.paidP,
        codDueP: order.codDueP,
        vat: {
          rateBp: store.vatRateBp,
          totalP: vatTotalP,
          netP: order.grandTotalP - vatTotalP,
        },
      };

      const invoice = await db.invoice.create({
        data: {
          orderId,
          invoiceNo,
          issuedAt: now,
          vatRateBp: store.vatRateBp,
          vatTotalP,
          grandTotalP: order.grandTotalP,
          binSnapshot: store.bin || null,
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      return { invoice, orderNo: order.orderNo };
    };
    const { invoice, orderNo } = tx ? await run(tx) : await this.prisma.$transaction(run);
    // The invoice just returned (existing latest or newly issued) is the current one.
    return invoiceView(invoice, orderNo, invoice.id);
  }

  /** Resolves an order by uuid or order number. */
  async resolveOrder(idOrNo: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNo);
    const order = await this.prisma.order.findFirst({
      where: isUuid ? { id: idOrNo } : { orderNo: idOrNo },
      select: { id: true, orderNo: true },
    });
    if (!order)
      throw new DocumentsError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found');
    return order;
  }

  async listForOrder(idOrNo: string) {
    const order = await this.resolveOrder(idOrNo);
    const rows = await this.prisma.invoice.findMany({
      where: { orderId: order.id },
      orderBy: [{ issuedAt: 'desc' }, { invoiceNo: 'desc' }],
    });
    const currentId = rows[0]?.id ?? '';
    return { items: rows.map((r) => invoiceView(r, order.orderNo, currentId)) };
  }

  async detail(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { order: { select: { orderNo: true } } },
    });
    if (!inv)
      throw new DocumentsError(HttpStatus.NOT_FOUND, 'INVOICE_NOT_FOUND', 'Invoice not found');
    const latest = await this.prisma.invoice.findFirst({
      where: { orderId: inv.orderId },
      orderBy: [{ issuedAt: 'desc' }, { invoiceNo: 'desc' }],
      select: { id: true },
    });
    return {
      ...invoiceView(inv, inv.order.orderNo, latest?.id ?? inv.id),
      snapshot: inv.snapshot as InvoiceSnapshot,
    };
  }

  /** Customer download: owner only, and only once goods have left (or the order is done). */
  async forCustomer(customerId: string, orderNo: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, customerId },
      select: {
        id: true,
        status: true,
        shipments: { where: { status: { in: [...SENT] } }, select: { id: true }, take: 1 },
      },
    });
    if (!order)
      throw new DocumentsError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found');
    const ready =
      order.status === 'delivered' || order.status === 'completed' || order.shipments.length > 0;
    if (!ready || order.status === 'cancelled') {
      throw new DocumentsError(
        HttpStatus.CONFLICT,
        'INVOICE_NOT_AVAILABLE',
        'The invoice is available once your order has shipped',
      );
    }
    const inv = await this.ensureIssued(order.id);
    return this.detail(inv.id);
  }
}
