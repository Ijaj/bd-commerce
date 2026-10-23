/** Taka string/number -> integer paisa. Empty or invalid -> null. */
export function takaToPaisa(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === '') return null;
  const n = typeof input === 'number' ? input : Number(String(input).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  // toPrecision absorbs binary float noise (1.005 * 100 = 100.49999999999999).
  return Math.round(Number((n * 100).toPrecision(12)));
}

/** Integer paisa -> taka number (12550 -> 125.5). */
export function paisaToTaka(paisa: number | null | undefined): number | '' {
  return paisa === null || paisa === undefined ? '' : paisa / 100;
}
