import { categoryIdsOf } from '../cart/cart.types';
import type { Prisma } from '../generated/prisma/client';
import type { OrderDiscountSnapshot } from '../promotions/types';

export const EDITABLE_STATUSES = ['processing', 'on_hold', 'pending_payment'];
/** Shipments that already hold a courier booking or left the warehouse: the order is frozen. */
export const FROZEN_SHIPMENTS = [
  'booked',
  'handed_over',
  'in_transit',
  'delivered',
  'failed',
  'returning',
  'returned',
];
/** Warehouse-only shipments: a saved edit cancels them (staff re-create from the new lines). */
export const LOCAL_SHIPMENTS = ['pending', 'awaiting_supplier', 'supplier_confirmed', 'ready'];

export const variantInclude = {
  inventory: true,
  optionValue1: true,
  optionValue2: true,
  images: { orderBy: { sort: 'asc' }, take: 1, include: { media: true } },
  product: {
    include: {
      primaryCategory: { select: { isActive: true, returnWindowDays: true, path: true } },
      categories: { select: { category: { select: { path: true } } } },
      images: {
        where: { variantId: null },
        orderBy: { sort: 'asc' },
        take: 1,
        include: { media: true },
      },
    },
  },
} satisfies Prisma.VariantInclude;

export type EditVariant = Prisma.VariantGetPayload<{ include: typeof variantInclude }>;

export async function loadVariants(tx: Prisma.TransactionClient, ids: string[]) {
  const rows = await tx.variant.findMany({
    where: { id: { in: ids } },
    include: variantInclude,
  });
  return new Map(rows.map((v) => [v.id, v]));
}

export function categoriesOf(v: EditVariant) {
  return categoryIdsOf([
    v.product.primaryCategory.path,
    ...v.product.categories.map((c) => c.category.path),
  ]);
}

/** A line of the order as it stands (active qty only). */
export interface CurLine {
  id: string;
  sellerId: string;
  productId: string;
  variantId: string;
  titleSnapshot: string;
  sku: string;
  optionsText: string | null;
  imageMediaId: string | null;
  qty: number;
  unitBaseP: number;
  unitPriceP: number;
  priceSource: string;
  discountP: number;
  flashSaleItemId: string | null;
  weightG: number | null;
  returnWindowDays: number | null;
  lineTotalP: number;
}

/** A line of the order after the edit. `itemId` null = a new order_items row. */
export interface OutLine {
  itemId: string | null;
  variantId: string;
  productId: string;
  qty: number;
  unitBaseP: number;
  unitPriceP: number;
  priceSource: 'base' | 'sale' | 'flash';
  flashItemId: string | null;
  discountP: number;
  title: string;
  sku: string;
  optionsText: string | null;
  weightG: number | null;
  change: 'same' | 'qty' | 'price' | 'added';
}

export interface Money {
  subtotalP: number;
  autoDiscountP: number;
  couponDiscountP: number;
  deliveryChargeP: number;
  deliveryDiscountP: number;
  grandTotalP: number;
  codDueP: number;
}

export interface Snapshot {
  ship: {
    name: string;
    phone: string;
    placeText: string;
    line: string;
    landmark: string | null;
    zoneId: string;
    zoneName: string;
  };
  lines: {
    variantId: string;
    title: string;
    qty: number;
    unitPriceP: number;
    lineTotalP: number;
    discountP: number;
  }[];
  money: Money;
  discounts: OrderDiscountSnapshot[];
}

export function snapshotLines(
  lines: { variantId: string; title: string; qty: number; unitPriceP: number; discountP: number }[],
) {
  return lines.map((l) => ({
    variantId: l.variantId,
    title: l.title,
    qty: l.qty,
    unitPriceP: l.unitPriceP,
    lineTotalP: l.unitPriceP * l.qty,
    discountP: l.discountP,
  }));
}
