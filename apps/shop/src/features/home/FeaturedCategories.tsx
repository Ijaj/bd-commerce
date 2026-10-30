import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Icon } from '~/components/Icon';
import { Img } from '~/components/Img';
import { dict, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import type { CategoryNode } from '~/lib/types';
import s from './FeaturedCategories.module.css';
import { readableOn } from './logic';

/**
 * Image tiles for the categories the owner flagged "show on home" (Q15): label on a solid chip
 * in the category's colour. Desktop grid; on phones two rows that scroll sideways.
 */
export function FeaturedCategories({ items, lang }: { items: CategoryNode[]; lang: Lang }) {
  const d = dict(lang);
  if (items.length === 0) return null;
  return (
    <section className={`wrap ${s.sec}`} aria-labelledby="h-cats">
      <div className="sec-head">
        <h2 id="h-cats">{d.home.shopBy}</h2>
        <Link className="link" href={href(lang, '/categories')}>
          {d.common.viewAll}
          <Icon name="chevR" size={16} />
        </Link>
      </div>
      <ul
        className={items.length <= 4 ? `${s.tiles} ${s.few}` : s.tiles}
        style={{ '--n': Math.min(items.length, 6) } as CSSProperties}
      >
        {items.map((c) => {
          const bg = c.chipColor ?? 'var(--primary)';
          return (
            <li key={c.id}>
              <Link className={s.tile} href={href(lang, `/c/${c.slug}`)}>
                <Img
                  className={s.img}
                  image={c.image}
                  alt=""
                  sizes="(max-width: 640px) 100px, (max-width: 1023px) 25vw, 220px"
                  placeholderRatio={4 / 3}
                />
                <span className={s.chip} style={{ background: bg, color: readableOn(c.chipColor) }}>
                  {pick(lang, c.nameEn, c.nameBn)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
