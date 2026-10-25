export interface VariantPricing {
  priceP: number;
  compareAtP: number | null;
  salePriceP: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
}

export interface EffectivePrice {
  priceP: number;
  compareAtP: number | null;
  discountPct: number | null;
  /** Where priceP comes from. */
  source: 'base' | 'sale' | 'flash';
  /** Set when source = flash: countdown target. */
  flashEndsAt: Date | null;
}

/** The live flash price of a variant (see promotions/flash/flash-core.ts#ActiveFlash). */
export interface FlashPrice {
  flashPriceP: number;
  endsAt: Date;
}

/**
 * What the customer pays for a variant right now. A sale only counts inside its window and when it
 * is really cheaper. Struck-through price on a sale = max(compareAtP, regular price). A live flash price wins when it is
 * lower still. The SQL twin of this rule lives in sql.ts; keep them in step.
 */
export function effectivePrice(
  v: VariantPricing,
  now: Date,
  flash: FlashPrice | null = null,
): EffectivePrice {
  const onSale =
    v.salePriceP !== null &&
    v.salePriceP < v.priceP &&
    (v.saleStartsAt === null || v.saleStartsAt <= now) &&
    (v.saleEndsAt === null || v.saleEndsAt > now);
  const afterSaleP = onSale ? (v.salePriceP as number) : v.priceP;
  const onFlash = flash !== null && flash.flashPriceP < afterSaleP;
  const priceP = onFlash ? flash.flashPriceP : afterSaleP;
  let compareAtP: number | null = null;
  if (onSale || onFlash) compareAtP = Math.max(v.compareAtP ?? 0, v.priceP);
  else if (v.compareAtP !== null && v.compareAtP > v.priceP) compareAtP = v.compareAtP;
  const discountPct =
    compareAtP !== null && compareAtP > priceP
      ? Math.round(((compareAtP - priceP) * 100) / compareAtP)
      : null;
  return {
    priceP,
    compareAtP: discountPct === null ? null : compareAtP,
    discountPct,
    source: onFlash ? 'flash' : onSale ? 'sale' : 'base',
    flashEndsAt: onFlash ? flash.endsAt : null,
  };
}

export function availableQty(inv: { onHand: number; reserved: number } | null | undefined) {
  return inv ? Math.max(inv.onHand - inv.reserved, 0) : 0;
}
