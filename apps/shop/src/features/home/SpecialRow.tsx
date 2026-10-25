'use client';
import { useEffect, useState } from 'react';
import { ProductCard } from '~/components/ProductCard';
import type { Lang } from '~/i18n';
import type { ProductCard as ProductCardData } from '~/lib/types';
import type { RowKind } from './logic';
import { readRecentIds } from './recent';
import s from './SpecialRow.module.css';

// Same ids -> one request, even when several recent rows are on the page.
const cache = new Map<string, Promise<ProductCardData[]>>();

function loadCards(ids: string[]): Promise<ProductCardData[]> {
  const key = ids.join(',');
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/v1/public/products/cards?ids=${key}`)
      .then((r) => (r.ok ? (r.json() as Promise<ProductCardData[]>) : []))
      .catch(() => []);
    cache.set(key, p);
  }
  return p;
}

function RecentRow({ lang, title }: { lang: Lang; title: string }) {
  const [items, setItems] = useState<ProductCardData[]>([]);
  useEffect(() => {
    const ids = readRecentIds();
    if (ids.length === 0) return;
    let live = true;
    loadCards(ids).then((c) => live && setItems(c));
    return () => {
      live = false;
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <section className={s.band} aria-label={title}>
      <div className="sec-head">
        <h2>{title}</h2>
      </div>
      <ul className={s.scroll}>
        {items.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} lang={lang} sizes="136px" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Row between product groups (Q18). `recent` reads localStorage on the client and renders
 * nothing when empty. `flash` and `event` are placeholders for step 6 (no data yet, render nothing).
 */
export function SpecialRow({
  kind,
  lang,
  recentTitle,
}: {
  kind: RowKind;
  lang: Lang;
  recentTitle: string;
}) {
  if (kind === 'recent') return <RecentRow lang={lang} title={recentTitle} />;
  return null;
}
