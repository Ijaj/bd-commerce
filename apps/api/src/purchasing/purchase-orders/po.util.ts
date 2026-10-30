const DHAKA_OFFSET_MS = 6 * 60 * 60_000;

/** `YYMM` of the Asia/Dhaka calendar month, as in order numbers. */
export function dhakaYymm(now: Date) {
  const d = new Date(now.getTime() + DHAKA_OFFSET_MS);
  return `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Today in Asia/Dhaka as `YYYY-MM-DD`. */
export function dhakaToday(now = new Date()) {
  return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** `@db.Date` columns come back as UTC-midnight Dates. */
export function dateOnly(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function toDate(s: string | null | undefined) {
  return s ? new Date(`${s}T00:00:00.000Z`) : null;
}

/**
 * Weighted-average unit cost after receiving `qtyGood` at `unitP` (C64). With no old cost or
 * nothing (or a negative count) on hand, the PO price is the cost. Rounded half up to a paisa.
 */
export function weightedAverageCost(
  oldCostP: number | null,
  onHand: number,
  qtyGood: number,
  unitP: number,
) {
  if (oldCostP === null || onHand <= 0) return unitP;
  return Math.round((onHand * oldCostP + qtyGood * unitP) / (onHand + qtyGood));
}

export interface OptionLabel {
  en: string;
  bn: string | null;
}

export function optionLabels(v: {
  optionValue1: { valueEn: string; valueBn: string | null } | null;
  optionValue2: { valueEn: string; valueBn: string | null } | null;
}): OptionLabel[] {
  return [v.optionValue1, v.optionValue2]
    .filter((o) => o !== null)
    .map((o) => ({ en: o.valueEn, bn: o.valueBn }));
}

export const OPTION_INCLUDE = {
  optionValue1: { select: { valueEn: true, valueBn: true } },
  optionValue2: { select: { valueEn: true, valueBn: true } },
} as const;
