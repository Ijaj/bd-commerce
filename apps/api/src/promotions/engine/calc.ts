import {
  type BundleConfig,
  type BxgyConfig,
  bundleConfigSchema,
  bxgyConfigSchema,
  type PromoLine,
} from '../types';
import type { CouponCandidate, EngineState } from './engine.types';

/**
 * What a coupon type would give before the max-discount cap: `total` split over lines in proportion
 * to `weights` (per variant line, already bounded by what is left of that line), or a delivery waiver.
 */
export interface RawDiscount {
  total: number;
  weights: Map<string, number>;
  deliveryP: number;
}

const left = (state: EngineState, l: PromoLine) => state.remaining.get(l.variantId) ?? 0;

function sumLeft(lines: PromoLine[], state: EngineState) {
  return lines.reduce((s, l) => s + left(state, l), 0);
}

function byRemaining(lines: PromoLine[], state: EngineState) {
  return new Map(lines.map((l) => [l.variantId, left(state, l)]));
}

/** Units of a line as a flat list, so "cheapest N units" is a sort. */
function units(lines: PromoLine[]) {
  return lines.flatMap((l) =>
    Array.from({ length: l.qty }, () => ({ variantId: l.variantId, priceP: l.unitPriceP })),
  );
}

function bxgy(cfg: BxgyConfig, eligible: PromoLine[], all: PromoLine[], state: EngineState) {
  const getIds = new Set(cfg.getProductIds);
  let buy = eligible;
  let get: PromoLine[] = eligible;
  let groups: number;
  if (cfg.getSame) {
    groups = Math.floor(eligible.reduce((n, l) => n + l.qty, 0) / (cfg.buyQty + cfg.getQty));
  } else {
    if (getIds.size === 0) return null;
    buy = eligible.filter((l) => !getIds.has(l.productId));
    // The free item need not be in the coupon's own scope, but a sale price is still not discounted twice.
    get = all.filter((l) => getIds.has(l.productId) && l.priceSource === 'base');
    const buyUnits = buy.reduce((n, l) => n + l.qty, 0);
    const getUnits = get.reduce((n, l) => n + l.qty, 0);
    groups = Math.min(Math.floor(buyUnits / cfg.buyQty), Math.floor(getUnits / cfg.getQty));
  }
  if (groups <= 0) return null;

  // Priciest units are "bought", the cheapest ones are "got" (the customer never loses on rounding).
  const pool = units(get).sort(
    (a, b) => b.priceP - a.priceP || a.variantId.localeCompare(b.variantId),
  );
  const picked = pool.slice(pool.length - groups * cfg.getQty);
  const weights = new Map<string, number>();
  for (const u of picked) {
    const off = Math.floor((u.priceP * cfg.getPctBp) / 10000);
    weights.set(u.variantId, (weights.get(u.variantId) ?? 0) + off);
  }
  for (const [id, w] of weights) {
    weights.set(id, Math.min(w, state.remaining.get(id) ?? 0));
  }
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  return { total, weights, deliveryP: 0 };
}

function bundle(cfg: BundleConfig, eligible: PromoLine[], state: EngineState) {
  const matching = cfg.items.map((it) =>
    eligible
      .filter(
        (l) => l.productId === it.productId && (!it.variantId || l.variantId === it.variantId),
      )
      .sort((a, b) => a.unitPriceP - b.unitPriceP || a.variantId.localeCompare(b.variantId)),
  );
  // Lines may match two items, so sets are found by actually taking units and backing off.
  const maxSets = Math.min(
    ...cfg.items.map((it, i) =>
      Math.floor((matching[i] ?? []).reduce((n, l) => n + l.qty, 0) / it.qty),
    ),
  );
  for (let sets = maxSets; sets >= 1; sets--) {
    const avail = new Map(eligible.map((l) => [l.variantId, l.qty]));
    const value = new Map<string, number>();
    let ok = true;
    for (const [i, it] of cfg.items.entries()) {
      let need = sets * it.qty;
      for (const l of matching[i] ?? []) {
        const take = Math.min(need, avail.get(l.variantId) ?? 0);
        avail.set(l.variantId, (avail.get(l.variantId) ?? 0) - take);
        value.set(l.variantId, (value.get(l.variantId) ?? 0) + take * l.unitPriceP);
        need -= take;
        if (need === 0) break;
      }
      if (need > 0) ok = false;
    }
    if (!ok) continue;
    const totalValue = [...value.values()].reduce((a, b) => a + b, 0);
    const weights = new Map(
      [...value].map(([id, v]) => [id, Math.min(v, state.remaining.get(id) ?? 0)]),
    );
    return { total: Math.max(totalValue - sets * cfg.priceP, 0), weights, deliveryP: 0 };
  }
  return null;
}

/** Raw discount of one coupon on the lines it may touch; null = nothing to give. */
export function rawDiscount(
  c: CouponCandidate,
  eligible: PromoLine[],
  all: PromoLine[],
  state: EngineState,
): RawDiscount | null {
  const { coupon } = c;
  const eligibleP = sumLeft(eligible, state);
  switch (coupon.type) {
    case 'percent':
      return {
        total: Math.floor((eligibleP * coupon.value) / 10000),
        weights: byRemaining(eligible, state),
        deliveryP: 0,
      };
    case 'fixed':
      return {
        total: Math.min(coupon.value, eligibleP),
        weights: byRemaining(eligible, state),
        deliveryP: 0,
      };
    case 'tiered': {
      const tier = c.tiers
        .filter((t) => t.minSpendP <= eligibleP)
        .sort((a, b) => b.minSpendP - a.minSpendP)[0];
      return tier
        ? { total: tier.discountP, weights: byRemaining(eligible, state), deliveryP: 0 }
        : null;
    }
    case 'free_delivery':
      return { total: 0, weights: new Map(), deliveryP: Math.max(state.deliveryLeftP, 0) };
    case 'bxgy': {
      const cfg = bxgyConfigSchema.safeParse(coupon.config);
      return cfg.success ? bxgy(cfg.data, eligible, all, state) : null;
    }
    case 'bundle': {
      const cfg = bundleConfigSchema.safeParse(coupon.config);
      return cfg.success ? bundle(cfg.data, eligible, state) : null;
    }
  }
}
