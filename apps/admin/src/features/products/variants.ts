import dayjs from 'dayjs';
import type { ProductDetail, ProductVariant } from './types';

export const MAX_VARIANTS = 200;
export const MAX_OPTIONS = 2;

export interface OptionValueDraft {
  /** Stable key: the server id for saved values, a local uid for new ones. */
  key: string;
  id?: string;
  valueEn: string;
  valueBn: string;
  swatchHex: string;
}

export interface OptionDraft {
  key: string;
  id?: string;
  nameEn: string;
  nameBn: string;
  values: OptionValueDraft[];
}

export interface VariantRowDraft {
  id?: string;
  /**
   * Deactivated by the API because it has stock history. It keeps its SKU and stock, is shown
   * read-only and is never sent back in the variants PUT (that would be a 400).
   */
  retired: boolean;
  /** valueKeys joined: identifies the combination across edits. */
  comboKey: string;
  /** One option value key per option, in option order. Empty for a simple product. */
  valueKeys: string[];
  sku: string;
  /** True while the SKU is still the auto-suggestion (unsaved rows only): it follows label edits. */
  skuAuto: boolean;
  barcode: string;
  priceP: number | null;
  compareAtP: number | null;
  salePriceP: number | null;
  /** 'YYYY-MM-DD HH:mm:ss' local, as Mantine DateTimePicker wants it. */
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  costP: number | null;
  weightG: number | null;
  isActive: boolean;
  lowStockThreshold: number | null;
  /** Read-only: stock is changed on the Inventory page. */
  onHand: number;
  reserved: number;
  available: number;
}

let counter = 0;
export const newKey = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

export const comboKeyOf = (valueKeys: readonly string[]) => valueKeys.join('|');

// ---- loading from the API -------------------------------------------------------------------

export function optionsFromDetail(d: ProductDetail): OptionDraft[] {
  return [...d.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      key: o.id,
      id: o.id,
      nameEn: o.nameEn,
      nameBn: o.nameBn ?? '',
      values: [...o.values]
        .sort((a, b) => a.sort - b.sort)
        .map((v) => ({
          key: v.id,
          id: v.id,
          valueEn: v.valueEn,
          valueBn: v.valueBn ?? '',
          swatchHex: v.swatchHex ?? '',
        })),
    }));
}

const toLocal = (iso: string | null) => (iso ? dayjs(iso).format('YYYY-MM-DD HH:mm:ss') : null);

/**
 * A retired variant is inactive with no option values while the product has options or other
 * variants. (A simple product's only variant is never retired, even when switched off.)
 */
export function isRetired(v: ProductVariant, d: ProductDetail): boolean {
  return (
    !v.isActive &&
    v.optionValueIds.every((x) => x === null) &&
    (d.options.length > 0 || d.variants.some((o) => o.id !== v.id))
  );
}

export function rowsFromDetail(d: ProductDetail): VariantRowDraft[] {
  return [...d.variants]
    .sort((a, b) => a.sort - b.sort)
    .map((v) => {
      const valueKeys = v.optionValueIds.filter((x): x is string => !!x);
      return {
        id: v.id,
        retired: isRetired(v, d),
        comboKey: comboKeyOf(valueKeys),
        valueKeys,
        sku: v.sku,
        skuAuto: false,
        barcode: v.barcode ?? '',
        priceP: v.priceP,
        compareAtP: v.compareAtP,
        salePriceP: v.salePriceP,
        saleStartsAt: toLocal(v.saleStartsAt),
        saleEndsAt: toLocal(v.saleEndsAt),
        costP: v.costP ?? null,
        weightG: v.weightG,
        isActive: v.isActive,
        lowStockThreshold: v.lowStockThreshold,
        onHand: v.onHand,
        reserved: v.reserved,
        available: v.available,
      };
    });
}

// ---- combinations ---------------------------------------------------------------------------

/** Options that are complete enough to produce combinations (named, with at least one value). */
export function usableOptions(options: readonly OptionDraft[]): OptionDraft[] {
  return options
    .map((o) => ({ ...o, values: o.values.filter((v) => v.valueEn.trim()) }))
    .filter((o) => o.nameEn.trim() && o.values.length > 0)
    .slice(0, MAX_OPTIONS);
}

export function comboCount(options: readonly OptionDraft[]): number {
  return usableOptions(options).reduce((n, o) => n * o.values.length, 1);
}

/** Cartesian product of option value keys. 0 usable options -> one empty combination (simple product). */
export function generateCombos(options: readonly OptionDraft[]): string[][] {
  let combos: string[][] = [[]];
  for (const o of usableOptions(options)) {
    combos = combos.flatMap((c) => o.values.map((v) => [...c, v.key]));
  }
  return combos.slice(0, MAX_VARIANTS);
}

export function comboLabel(options: readonly OptionDraft[], valueKeys: readonly string[]): string {
  const usable = usableOptions(options);
  return valueKeys
    .map((k, i) => usable[i]?.values.find((v) => v.key === k)?.valueEn.trim() ?? '')
    .filter(Boolean)
    .join(' / ');
}

// ---- SKU ------------------------------------------------------------------------------------

const code = (s: string, max: number) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, max);

/** "cotton-tee" + ["Red", "Large"] -> "COTTON-TEE-RED-LARGE"; capped at 64 chars. */
export function suggestSku(slug: string, valueLabels: readonly string[]): string {
  const base =
    slug
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'SKU';
  const parts = valueLabels.map((l) => code(l, 8)).filter(Boolean);
  return [base, ...parts].join('-').slice(0, 64);
}

/** Appends -2, -3... until the SKU is not in `taken` (case-insensitive). */
export function uniqueSku(sku: string, taken: ReadonlySet<string>): string {
  const t = new Set([...taken].map((s) => s.toUpperCase()));
  if (!t.has(sku.toUpperCase())) return sku;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${sku.slice(0, 64 - suffix.length)}${suffix}`;
    if (!t.has(candidate.toUpperCase())) return candidate;
  }
}

// ---- keeping rows in step with the options --------------------------------------------------

export function blankRow(valueKeys: string[], sku: string): VariantRowDraft {
  return {
    retired: false,
    comboKey: comboKeyOf(valueKeys),
    valueKeys,
    sku,
    skuAuto: true,
    barcode: '',
    priceP: null,
    compareAtP: null,
    salePriceP: null,
    saleStartsAt: null,
    saleEndsAt: null,
    costP: null,
    weightG: null,
    isActive: true,
    lowStockThreshold: null,
    onHand: 0,
    reserved: 0,
    available: 0,
  };
}

const isPrefix = (a: readonly string[], b: readonly string[]) =>
  a.length <= b.length && a.every((k, i) => k === b[i]);

/**
 * Rebuilds the matrix for the current options. Existing rows (and so their variant ids, stock and
 * edits) are kept when their combination still exists. A row whose combination vanished is carried
 * over to a new combination it prefixes or extends (simple -> options, adding or dropping the
 * second option), so stock history survives structural edits. Truly new combinations get a
 * suggested, unique SKU.
 */
export function syncRows(
  options: readonly OptionDraft[],
  allPrev: readonly VariantRowDraft[],
  slug: string,
): VariantRowDraft[] {
  const retired = allPrev.filter((r) => r.retired);
  const prev = allPrev.filter((r) => !r.retired);
  const combos = generateCombos(options);
  const comboSet = new Map(combos.map((c) => [comboKeyOf(c), c]));
  const prevByKey = new Map(prev.map((r) => [r.comboKey, r]));

  const assigned = new Map<string, VariantRowDraft>();
  for (const c of combos) {
    const k = comboKeyOf(c);
    const hit = prevByKey.get(k);
    if (hit) assigned.set(k, hit);
  }
  const orphans = prev.filter((r) => !comboSet.has(r.comboKey));
  for (const r of orphans) {
    const target = combos.find(
      (c) => !assigned.has(comboKeyOf(c)) && (isPrefix(r.valueKeys, c) || isPrefix(c, r.valueKeys)),
    );
    if (target) assigned.set(comboKeyOf(target), r);
  }

  // Retired variants keep their SKU forever, so new suggestions must avoid them too.
  const taken = new Set(
    [...assigned.values(), ...retired]
      .filter((r) => r.retired || !r.skuAuto || r.id)
      .map((r) => r.sku)
      .filter(Boolean),
  );
  const live = combos.map((c) => {
    const k = comboKeyOf(c);
    const row = assigned.get(k);
    if (row && (!row.skuAuto || row.id)) return { ...row, comboKey: k, valueKeys: c };
    const sku = uniqueSku(suggestSku(slug, labelsOf(options, c)), taken);
    taken.add(sku);
    return row ? { ...row, sku, comboKey: k, valueKeys: c } : blankRow(c, sku);
  });
  return [...live, ...retired];
}

function labelsOf(options: readonly OptionDraft[], valueKeys: readonly string[]) {
  const usable = usableOptions(options);
  return valueKeys.map((k, i) => usable[i]?.values.find((v) => v.key === k)?.valueEn ?? '');
}

/** Combination keys whose SKU is empty or repeated (case-insensitive) within the matrix. */
export function skuProblems(allRows: readonly VariantRowDraft[]): Set<string> {
  const rows = allRows.filter((r) => !r.retired);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const s = r.sku.trim().toUpperCase();
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return new Set(
    rows
      .filter((r) => {
        const s = r.sku.trim().toUpperCase();
        return !s || (counts.get(s) ?? 0) > 1;
      })
      .map((r) => r.comboKey),
  );
}

// ---- payload --------------------------------------------------------------------------------

export interface VariantsPayload {
  options: {
    position: 1 | 2;
    nameEn: string;
    nameBn: string | null;
    values: { id?: string; valueEn: string; valueBn: string | null; swatchHex: string | null }[];
  }[];
  variants: {
    id?: string;
    optionValueRefs: (string | number)[];
    sku: string;
    barcode: string | null;
    priceP: number;
    compareAtP: number | null;
    salePriceP: number | null;
    saleStartsAt: string | null;
    saleEndsAt: string | null;
    costP?: number | null;
    weightG: number | null;
    isActive: boolean;
    lowStockThreshold: number | null;
  }[];
}

const blank = (s: string) => (s.trim() ? s.trim() : null);
const iso = (s: string | null) => (s ? dayjs(s).toISOString() : null);

/**
 * Body for PUT /products/:id/variants. `costP` is left out entirely unless the staff may view
 * costs, so an edit by someone without products.view_cost can never touch it.
 */
export function buildVariantsPayload(
  options: readonly OptionDraft[],
  rows: readonly VariantRowDraft[],
  perms: { canViewCost: boolean },
): VariantsPayload {
  const usable = usableOptions(options);
  return {
    options: usable.map((o, i) => ({
      position: (i + 1) as 1 | 2,
      nameEn: o.nameEn.trim(),
      nameBn: blank(o.nameBn),
      values: o.values.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        valueEn: v.valueEn.trim(),
        valueBn: blank(v.valueBn),
        swatchHex: v.swatchHex || null,
      })),
    })),
    variants: rows
      .filter((r) => !r.retired)
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        optionValueRefs: r.valueKeys.map((k, i) => {
          const values = usable[i]?.values ?? [];
          const idx = values.findIndex((v) => v.key === k);
          return values[idx]?.id ?? idx;
        }),
        sku: r.sku.trim(),
        barcode: blank(r.barcode),
        priceP: r.priceP ?? 0,
        compareAtP: r.compareAtP,
        salePriceP: r.salePriceP,
        saleStartsAt: iso(r.saleStartsAt),
        saleEndsAt: iso(r.saleEndsAt),
        ...(perms.canViewCost ? { costP: r.costP } : {}),
        weightG: r.weightG,
        isActive: r.isActive,
        lowStockThreshold: r.lowStockThreshold,
      })),
  };
}
