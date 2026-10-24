'use client';
import { useEffect, useState } from 'react';
import { ProductCard } from '~/components/ProductCard';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import { dict, type Lang } from '~/i18n';
import type { ProductCard as Card } from '~/lib/types';
import { pushRecent } from './logic';
import s from './Product.module.css';

const KEY = 'bdc_recent'; // shared with the home page row (C29: localStorage only)

function read(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Records this product as viewed (last 20 ids) and shows the previous ones as a card row.
 * Renders nothing until the browser has ids to show, so there is no layout jump for first visits.
 */
export function RecentlyViewed({ productId, lang }: { productId: string; lang: Lang }) {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    const before = read().filter((x) => x !== productId);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(pushRecent(read(), productId)));
    } catch {
      // storage blocked: the row just stays empty next time
    }
    const ids = before.slice(0, 12);
    if (ids.length === 0) return;
    const ctl = new AbortController();
    fetch(`/v1/public/products/cards?ids=${ids.join(',')}`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Card[]>) : []))
      .then(setCards)
      .catch(() => {});
    return () => ctl.abort();
  }, [productId]);

  if (cards.length === 0) return null;
  const title = dict(lang).browse.recent;
  return (
    <section className={s.rowSec} aria-labelledby="recent-h">
      <div className="sec-head">
        <h2 id="recent-h">{title}</h2>
      </div>
      <ul className={s.row}>
        {cards.map((c) => (
          <li key={c.id}>
            <ProductCard
              product={c}
              lang={lang}
              heart={<WishlistHeart productId={c.id} lang={lang} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
