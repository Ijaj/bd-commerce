import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ProductCardService } from './product-card.service';
import type { ProductCard } from './public.dto';
import { PRODUCT_FROM, PUBLIC_WHERE, sql } from './sql';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 52 bits of the md5 hash map to a uniform number in (0, 1).
const TWO_POW_52 = 4503599627370496;

function encodeCursor(key: number, id: string) {
  return Buffer.from(JSON.stringify({ k: key, id })).toString('base64url');
}

function decodeCursor(cursor: string): { key: number; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
      k?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.k === 'number' &&
      Number.isFinite(parsed.k) &&
      typeof parsed.id === 'string' &&
      UUID.test(parsed.id)
    ) {
      return { key: parsed.k, id: parsed.id };
    }
  } catch {
    // fall through
  }
  throw new BadRequestException('Invalid cursor');
}

/**
 * Weighted random feed (Q16/Q17). Each product gets the A-Res key ln(u)/w, where u is a
 * per-(seed, product) hash in (0, 1) and w the weight from the home_feed setting. Sorting by the
 * key descending gives a weighted shuffle that is fixed for a seed, so pages never overlap.
 * The cursor is the last (key, id) pair.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cards: ProductCardService,
  ) {}

  async page(seed: number, cursor: string | undefined, limit: number) {
    const after = cursor ? decodeCursor(cursor) : null;
    const f = await this.settings.get('home_feed');

    const discount = sql`(CASE WHEN cv.compare > cv.price
      THEN (cv.compare - cv.price) * 100.0 / cv.compare ELSE 0 END)`;
    const weight = sql`greatest(0.0001::float8,
      (1 + ${f.newBoost}::float8 * (p.published_at > now() - make_interval(days => ${f.newDays}::int))::int)
      * (1 + ${f.discountBoost}::float8 * least(${discount}, 50)::float8 / 50.0)
      * (1 + ${f.ratingBoost}::float8 * (p.rating_avg::float8 / 5.0) * least(1.0, p.rating_count / 10.0)::float8)
      * (1 + p.is_pinned::int * (${f.pinnedBoost}::float8 + p.pin_boost / 10.0))
      * CASE WHEN st.stock <= 0 AND NOT p.is_preorder AND NOT p.is_upcoming
          THEN ${f.outOfStockPenalty}::float8 ELSE 1.0 END)`;
    const unit = sql`((('x' || substr(md5(p.id::text || ':' || ${String(seed)}::text), 1, 13))::bit(52)::bigint)::float8 + 0.5)
      / ${TWO_POW_52}::float8`;

    const rows = await this.prisma.$queryRaw<{ id: string; k: number }[]>`
      SELECT id, k FROM (
        SELECT p.id, ln(${unit}) / ${weight} AS k
        ${PRODUCT_FROM}
        WHERE ${PUBLIC_WHERE}
      ) s
      ${after ? sql`WHERE s.k < ${after.key}::float8 OR (s.k = ${after.key}::float8 AND s.id > ${after.id}::uuid)` : sql``}
      ORDER BY s.k DESC, s.id ASC
      LIMIT ${limit + 1}`;

    const pageRows = rows.slice(0, limit);
    const last = pageRows[pageRows.length - 1];
    const items: ProductCard[] = await this.cards.cards(pageRows.map((r) => r.id));
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last.k, last.id) : null,
    };
  }
}
