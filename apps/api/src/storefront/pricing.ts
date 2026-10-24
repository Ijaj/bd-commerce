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
}

/**
 * What the customer pays for a variant right now. A sale only counts inside its window and when it
 * is really cheaper. Struck-through price on a sale = max(compareAtP, regular price). The SQL twin
 * of this rule lives in sql.ts; keep them in step.
 */
export function effectivePrice(v: VariantPricing, now: Date): EffectivePrice {
  const onSale =
    v.salePriceP !== null &&
    v.salePriceP < v.priceP &&
    (v.saleStartsAt === null || v.saleStartsAt <= now) &&
    (v.saleEndsAt === null || v.saleEndsAt > now);
  const priceP = onSale ? (v.salePriceP as number) : v.priceP;
  let compareAtP: number | null = null;
  if (onSale) compareAtP = Math.max(v.compareAtP ?? 0, v.priceP);
  else if (v.compareAtP !== null && v.compareAtP > v.priceP) compareAtP = v.compareAtP;
  const discountPct =
    compareAtP !== null && compareAtP > priceP
      ? Math.round(((compareAtP - priceP) * 100) / compareAtP)
      : null;
  return { priceP, compareAtP: discountPct === null ? null : compareAtP, discountPct };
}

export function availableQty(inv: { onHand: number; reserved: number } | null | undefined) {
  return inv ? Math.max(inv.onHand - inv.reserved, 0) : 0;
}
