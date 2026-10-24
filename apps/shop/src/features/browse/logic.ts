import type { ProductDetail, ProductOption, ProductVariant } from './types';

/** Selected option value ids by position: [option 1, option 2]. */
export type Selection = [string | null, string | null];

/** Orderable now: pre-order products ignore stock, up-coming ones are never orderable. */
export function canOrder(
  v: ProductVariant | null,
  p: Pick<ProductDetail, 'isPreorder' | 'isUpcoming'>,
): boolean {
  if (!v?.isActive || p.isUpcoming) return false;
  return p.isPreorder || v.available > 0;
}

/** Highest quantity the stepper allows (the cart API clamps again). */
export function maxQty(
  v: ProductVariant | null,
  p: Pick<ProductDetail, 'isPreorder'>,
  cap = 10,
): number {
  if (!v) return 1;
  return p.isPreorder ? cap : Math.max(1, Math.min(v.available, cap));
}

export function variantFor(
  variants: ProductVariant[],
  sel: Selection,
  options: ProductOption[],
): ProductVariant | null {
  const active = variants.filter((v) => v.isActive);
  if (options.length === 0) return active[0] ?? null;
  return (
    active.find(
      (v) => v.optionValue1Id === sel[0] && (options.length < 2 || v.optionValue2Id === sel[1]),
    ) ?? null
  );
}

/** First orderable variant (else first active) as the initial selection. */
export function initialSelection(
  p: Pick<ProductDetail, 'variants' | 'options' | 'isPreorder' | 'isUpcoming'>,
): Selection {
  const active = p.variants.filter((v) => v.isActive);
  const pick = active.find((v) => canOrder(v, p)) ?? active[0];
  return [pick?.optionValue1Id ?? null, pick?.optionValue2Id ?? null];
}

/**
 * State of an option value given the current choice of the other option:
 * 'none' = no active variant has this combination, 'soldout' = exists but not orderable, 'ok'.
 */
export function valueState(
  p: Pick<ProductDetail, 'variants' | 'options' | 'isPreorder' | 'isUpcoming'>,
  position: 1 | 2,
  valueId: string,
  sel: Selection,
): 'ok' | 'soldout' | 'none' {
  const other = position === 1 ? sel[1] : sel[0];
  const matches = p.variants.filter((v) => {
    if (!v.isActive) return false;
    const mine = position === 1 ? v.optionValue1Id : v.optionValue2Id;
    if (mine !== valueId) return false;
    if (p.options.length < 2 || other === null) return true;
    return (position === 1 ? v.optionValue2Id : v.optionValue1Id) === other;
  });
  if (matches.length === 0) return 'none';
  return matches.some((v) => canOrder(v, p)) ? 'ok' : 'soldout';
}

/** When picking a value leaves no valid combination, move the other option to the first that works. */
export function selectValue(
  p: Pick<ProductDetail, 'variants' | 'options' | 'isPreorder' | 'isUpcoming'>,
  position: 1 | 2,
  valueId: string,
  sel: Selection,
): Selection {
  const next: Selection = position === 1 ? [valueId, sel[1]] : [sel[0], valueId];
  if (p.options.length < 2 || variantFor(p.variants, next, p.options)) return next;
  const fit = p.variants.find(
    (v) => v.isActive && (position === 1 ? v.optionValue1Id : v.optionValue2Id) === valueId,
  );
  return fit ? [fit.optionValue1Id, fit.optionValue2Id] : next;
}

/** YouTube video id from watch / youtu.be / embed / shorts URLs; null for anything else. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?]+)/);
        id = m?.[1] ?? null;
      }
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Recently viewed ids: newest first, no duplicates, capped (C29, key bdc_recent). */
export function pushRecent(prev: string[], id: string, max = 20): string[] {
  return [id, ...prev.filter((x) => x !== id)].slice(0, max);
}
