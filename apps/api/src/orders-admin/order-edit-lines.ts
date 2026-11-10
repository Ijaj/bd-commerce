import type { CurLine, OutLine } from './order-edit-support';

/** One entry of the desired list: an existing line (`item`) or new units of a variant. */
export interface EditReq {
  item: CurLine | null;
  variantId: string;
  qty: number;
}

/** Today's price for added units of a variant. */
export interface UnitPrice {
  priceP: number;
  unitBaseP: number;
  source: 'base' | 'sale' | 'flash';
  flashItemId: string | null;
  productId: string;
  title: string;
  sku: string;
  optionsText: string | null;
  weightG: number | null;
}

/**
 * C90: units the staff did not touch keep the price the customer ordered at. Added units are priced
 * at today's price. When that equals the old price the units join the existing line; otherwise they
 * become a second line of the same variant (the engine and the stock ledger work per variant, and
 * returns/refunds work per line, so a split keeps every unit's price exact with no rounding).
 */
export function buildLines(
  reqs: EditReq[],
  cur: CurLine[],
  priceFor: (variantId: string) => UnitPrice,
) {
  const out: OutLine[] = [];
  const extras: { req: EditReq; extra: number }[] = [];
  const usedItems = new Set<string>();

  for (const r of reqs) {
    if (!r.item) {
      if (r.qty > 0) extras.push({ req: r, extra: r.qty });
      continue;
    }
    usedItems.add(r.item.id);
    const kept = Math.min(r.item.qty, r.qty);
    if (kept > 0) {
      out.push({
        itemId: r.item.id,
        variantId: r.item.variantId,
        productId: r.item.productId,
        qty: kept,
        unitBaseP: r.item.unitBaseP,
        unitPriceP: r.item.unitPriceP,
        priceSource: r.item.priceSource as OutLine['priceSource'],
        flashItemId: r.item.priceSource === 'flash' ? r.item.flashSaleItemId : null,
        discountP: 0,
        title: r.item.titleSnapshot,
        sku: r.item.sku,
        optionsText: r.item.optionsText,
        weightG: r.item.weightG,
        change: kept === r.item.qty ? 'same' : 'qty',
      });
    }
    if (r.qty > r.item.qty) extras.push({ req: r, extra: r.qty - r.item.qty });
  }

  for (const { req, extra } of extras) {
    const p = priceFor(req.variantId);
    const twin = out.find(
      (l) =>
        l.variantId === req.variantId &&
        l.unitPriceP === p.priceP &&
        l.flashItemId === p.flashItemId,
    );
    if (twin) {
      twin.qty += extra;
      if (twin.change === 'same') twin.change = 'qty';
      continue;
    }
    out.push({
      itemId: null,
      variantId: req.variantId,
      productId: p.productId,
      qty: extra,
      unitBaseP: p.unitBaseP,
      unitPriceP: p.priceP,
      priceSource: p.source,
      flashItemId: p.flashItemId,
      discountP: 0,
      title: p.title,
      sku: p.sku,
      optionsText: p.optionsText,
      weightG: p.weightG,
      change: req.item ? 'price' : 'added',
    });
  }

  const removed = cur.filter((c) => !out.some((l) => l.itemId === c.id));
  return { out, removed };
}
