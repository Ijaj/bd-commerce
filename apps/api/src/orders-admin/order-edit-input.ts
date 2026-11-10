import { HttpStatus } from '@nestjs/common';
import type { PromoLine } from '../promotions/types';
import type { OrderEditInputDto } from './order-edit.dto';
import { OrderEditError } from './order-edit.errors';
import type { EditReq } from './order-edit-lines';
import {
  type CurLine,
  categoriesOf,
  type EditVariant,
  type OutLine,
  type Snapshot,
} from './order-edit-support';

export function typedCodes(discounts: Snapshot['discounts']) {
  return discounts.flatMap((d) => (d.kind === 'code' && d.code ? [d.code] : []));
}

export function parseLines(input: OrderEditInputDto, cur: CurLine[]): EditReq[] {
  if (!input.lines) return cur.map((c) => ({ item: c, variantId: c.variantId, qty: c.qty }));
  const byId = new Map(cur.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const reqs: EditReq[] = [];
  for (const l of input.lines) {
    if (l.orderItemId) {
      const item = byId.get(l.orderItemId);
      if (!item || seen.has(item.id)) {
        throw new OrderEditError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'EDIT_INVALID',
          'A line in the request is not part of this order.',
          { orderItemId: l.orderItemId },
        );
      }
      seen.add(item.id);
      reqs.push({ item, variantId: item.variantId, qty: l.qty });
    } else if (l.variantId && l.qty >= 1) {
      reqs.push({ item: null, variantId: l.variantId, qty: l.qty });
    } else {
      throw new OrderEditError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'EDIT_INVALID',
        'A new line needs a variantId and a quantity of at least 1.',
      );
    }
  }
  return reqs;
}

/** The engine works per variant: lines of one variant (a split) go in as one, at their average price. */
export function promoLines(out: OutLine[], variants: Map<string, EditVariant>): PromoLine[] {
  const rank = { base: 0, sale: 1, flash: 2 } as const;
  const byVariant = new Map<string, OutLine[]>();
  for (const l of out) byVariant.set(l.variantId, [...(byVariant.get(l.variantId) ?? []), l]);
  return [...byVariant].map(([variantId, lines]) => {
    const v = variants.get(variantId);
    const qty = lines.reduce((n, l) => n + l.qty, 0);
    const total = lines.reduce((n, l) => n + l.unitPriceP * l.qty, 0);
    const source = lines.reduce<OutLine['priceSource']>(
      (s, l) => (rank[l.priceSource] > rank[s] ? l.priceSource : s),
      'base',
    );
    return {
      variantId,
      productId: lines[0]?.productId as string,
      brandId: v?.product.brandId ?? null,
      categoryIds: v ? categoriesOf(v) : [],
      qty,
      // Floor: the engine can never discount more than the lines are worth.
      unitPriceP: Math.floor(total / qty),
      priceSource: source,
    };
  });
}

export function soldDeltas(cur: CurLine[], out: OutLine[]) {
  const delta = new Map<string, number>();
  for (const c of cur) delta.set(c.productId, (delta.get(c.productId) ?? 0) - c.qty);
  for (const l of out) delta.set(l.productId, (delta.get(l.productId) ?? 0) + l.qty);
  return [...delta].filter(([, q]) => q !== 0).map(([productId, qty]) => ({ productId, qty }));
}
