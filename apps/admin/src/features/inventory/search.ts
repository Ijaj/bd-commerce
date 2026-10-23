export interface InventorySearch {
  q?: string;
  lowStock?: boolean;
  category?: string;
  fulfillment?: 'stock' | 'dropship';
  page?: number;
  size?: number;
}

const PAGE_SIZES = [20, 50, 100];

function positiveInt(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Router validateSearch: tolerant of hand-edited URLs, drops anything it does not understand. */
export function parseInventorySearch(raw: Record<string, unknown>): InventorySearch {
  const out: InventorySearch = {};
  if (raw.q !== undefined && raw.q !== null && String(raw.q).trim()) out.q = String(raw.q).trim();
  if (raw.lowStock === true || raw.lowStock === 'true') out.lowStock = true;
  if (typeof raw.category === 'string' && raw.category) out.category = raw.category;
  if (raw.fulfillment === 'stock' || raw.fulfillment === 'dropship') {
    out.fulfillment = raw.fulfillment;
  }
  const page = positiveInt(raw.page);
  if (page && page > 1) out.page = page;
  const size = positiveInt(raw.size);
  if (size && PAGE_SIZES.includes(size) && size !== PAGE_SIZES[0]) out.size = size;
  return out;
}

export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0] as number;
export { PAGE_SIZES };
