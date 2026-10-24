import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductCardService } from './product-card.service';
import type { Crumb } from './public.dto';
import { PRODUCT_FROM, PUBLIC_WHERE } from './sql';

/** Escapes LIKE wildcards so user text is matched literally. */
function likeEscape(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: ProductCardService,
  ) {}

  /** Type-ahead: prefix and substring matches first, trigram matches for typos. */
  async suggest(q: string) {
    const contains = `%${likeEscape(q)}%`;
    const prefix = `${likeEscape(q)}%`;
    const [productRows, categories, brands] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id ${PRODUCT_FROM}
        WHERE ${PUBLIC_WHERE}
          AND (p.title_en ILIKE ${contains} OR ${q} <% p.title_en)
        ORDER BY (p.title_en ILIKE ${prefix}) DESC, word_similarity(${q}, p.title_en) DESC,
                 p.sold_count DESC, p.id
        LIMIT 6`,
      this.prisma.$queryRaw<Crumb[]>`
        SELECT c.slug, c.name_en AS "nameEn", c.name_bn AS "nameBn"
        FROM categories c
        WHERE c.is_active
          AND NOT EXISTS (SELECT 1 FROM categories ic WHERE NOT ic.is_active AND starts_with(c.path, ic.path))
          AND (c.name_en ILIKE ${contains} OR c.name_bn ILIKE ${contains})
        ORDER BY (c.name_en ILIKE ${prefix}) DESC, c.level, c.name_en
        LIMIT 4`,
      this.prisma.$queryRaw<{ slug: string; nameEn: string; nameBn: string | null }[]>`
        SELECT b.slug, b.name_en AS "nameEn", b.name_bn AS "nameBn"
        FROM brands b
        WHERE b.active AND (b.name_en ILIKE ${contains} OR b.name_bn ILIKE ${contains} OR ${q} <% b.name_en)
        ORDER BY (b.name_en ILIKE ${prefix}) DESC, b.name_en
        LIMIT 4`,
    ]);
    const cards = await this.cards.cards(productRows.map((r) => r.id));
    return {
      products: cards.map((c) => ({
        slug: c.slug,
        titleEn: c.titleEn,
        titleBn: c.titleBn,
        image: c.image,
        priceP: c.priceP,
      })),
      categories,
      brands,
    };
  }
}
