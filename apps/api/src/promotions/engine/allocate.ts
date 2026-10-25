/**
 * Splits `total` across weights in proportion, largest remainder first, so the parts sum to `total`
 * exactly. Zero weights get nothing; ties go to the earlier index (stable, deterministic).
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const base = weights.map((w) => Math.floor((total * w) / sum));
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, rem: (total * w) % sum, w }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const x of order) {
    if (left <= 0) break;
    base[x.i] = (base[x.i] as number) + 1;
    left -= 1;
  }
  return base;
}
