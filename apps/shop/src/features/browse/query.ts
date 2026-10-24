import { AVAILABILITY, type Availability, SORTS, type SortKey } from './types';

/**
 * Listing state lives in the URL (shareable, server-rendered, crawlable).
 * Prices are taka in the URL (`min`/`max`) and paisa towards the API.
 */
export type ListingQuery = {
  q: string;
  brand: string[];
  /** taka */
  min: number | null;
  max: number | null;
  rating: number | null;
  availability: Availability[];
  /** attribute key -> option ids (or 'true') */
  attrs: Record<string, string[]>;
  sort: SortKey | null;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
const list = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : [v ?? ''])
    .flatMap((x) => x.split(','))
    .map((x) => x.trim())
    .filter(Boolean);
const posInt = (v: string): number | null => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && /^\d+$/.test(v.trim()) ? n : null;
};
const uniq = <T>(a: T[]): T[] => [...new Set(a)];

export function parseListingQuery(sp: RawSearchParams): ListingQuery {
  const attrs: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (!k.startsWith('attr.')) continue;
    const key = k.slice(5);
    const vals = uniq(list(v));
    if (key && vals.length) attrs[key] = vals;
  }
  const sort = first(sp.sort) as SortKey;
  const rating = posInt(first(sp.rating));
  return {
    q: first(sp.q).trim().slice(0, 100),
    brand: uniq(list(sp.brand)),
    min: posInt(first(sp.min)),
    max: posInt(first(sp.max)),
    rating: rating && rating >= 1 && rating <= 5 ? rating : null,
    availability: uniq(list(sp.availability)).filter((a): a is Availability =>
      (AVAILABILITY as readonly string[]).includes(a),
    ),
    attrs,
    sort: (SORTS as readonly string[]).includes(sort) ? sort : null,
    page: Math.max(1, Math.min(posInt(first(sp.page)) ?? 1, 500)),
  };
}

/** True when anything other than the page number narrows or reorders the list. */
export function isFiltered(q: ListingQuery, withText = true): boolean {
  return (
    (withText && q.q !== '') ||
    q.brand.length > 0 ||
    q.min !== null ||
    q.max !== null ||
    q.rating !== null ||
    q.availability.length > 0 ||
    Object.keys(q.attrs).length > 0 ||
    q.sort !== null
  );
}

/** Params for GET /v1/public/products. */
export function toApiParams(
  q: ListingQuery,
  extra: { category?: string; limit?: number } = {},
): Record<string, string | number> {
  const p: Record<string, string | number> = { page: q.page, limit: extra.limit ?? 24 };
  if (extra.category) p.category = extra.category;
  if (q.q) p.q = q.q;
  if (q.brand.length) p.brand = q.brand.join(',');
  if (q.min !== null) p.minPrice = q.min * 100;
  if (q.max !== null && q.max > 0) p.maxPrice = q.max * 100;
  if (q.rating) p.rating = q.rating;
  if (q.availability.length) p.availability = q.availability.join(',');
  if (q.sort) p.sort = q.sort;
  for (const [k, v] of Object.entries(q.attrs)) p[`attr.${k}`] = v.join(',');
  return p;
}

/** URL search string (with leading ?, or '') for the state; `over` replaces fields, page resets unless given. */
export function toSearch(q: ListingQuery, over: Partial<ListingQuery> = {}): string {
  const s: ListingQuery = { ...q, page: 1, ...over };
  const u = new URLSearchParams();
  if (s.q) u.set('q', s.q);
  if (s.brand.length) u.set('brand', s.brand.join(','));
  if (s.min !== null) u.set('min', String(s.min));
  if (s.max !== null) u.set('max', String(s.max));
  if (s.rating) u.set('rating', String(s.rating));
  if (s.availability.length) u.set('availability', s.availability.join(','));
  for (const [k, v] of Object.entries(s.attrs)) if (v.length) u.set(`attr.${k}`, v.join(','));
  if (s.sort) u.set('sort', s.sort);
  if (s.page > 1) u.set('page', String(s.page));
  const out = u.toString().replace(/%2C/g, ',');
  return out ? `?${out}` : '';
}
