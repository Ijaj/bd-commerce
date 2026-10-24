'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductGrid } from '~/components/ProductGrid';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import { fmt, type Lang } from '~/i18n';
import { formatNumber } from '~/lib/format';
import type { ProductCard } from '~/lib/types';
import s from './Feed.module.css';
import { chunk, FEED_LIMIT, rowKind } from './logic';
import { SpecialRow } from './SpecialRow';
import type { FeedPage } from './types';

export type FeedLabels = {
  loadMore: string;
  loading: string;
  /** "Showing {n} products" */
  showing: string;
  error: string;
  recent: string;
};

/**
 * Everything after the server-rendered first page: infinite scroll (IntersectionObserver on the
 * "load more" button, which also works as the manual fallback) with the same seed, so the order
 * is stable and duplicates are dropped by id. Special rows continue the slot count of the server part.
 *
 * `cursor === undefined` means the server could not load page 1; this component then loads it.
 */
export function FeedMore({
  seed,
  cursor: initialCursor,
  carry,
  firstSlot,
  shown,
  every,
  lang,
  labels,
}: {
  seed: number;
  cursor: string | null | undefined;
  /** Items of the first page that did not fill a whole group. */
  carry: ProductCard[];
  /** Special-row slot of the first group rendered here. */
  firstSlot: number;
  /** Products already rendered by the server (excluding `carry`). */
  shown: number;
  every: number;
  lang: Lang;
  labels: FeedLabels;
}) {
  const [items, setItems] = useState<ProductCard[]>(carry);
  const [cursor, setCursor] = useState<string | null | undefined>(initialCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const btn = useRef<HTMLButtonElement>(null);
  const done = cursor === null;

  const load = useCallback(async () => {
    if (busyRef.current || cursor === null) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const q = new URLSearchParams({ seed: String(seed), limit: String(FEED_LIMIT) });
      if (cursor) q.set('cursor', cursor);
      const res = await fetch(`/v1/public/feed?${q}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as FeedPage;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [cursor, seed]);

  // Auto-load while the button is near the viewport. Stops after a failure (button retries) so a
  // dead API is not hammered. Re-created after each page, so a still-visible button loads the next.
  useEffect(() => {
    const el = btn.current;
    if (!el || done || failed || busy || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && load(), {
      rootMargin: '800px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [done, failed, busy, load]);

  const groups = chunk(items, every);
  const total = shown + items.length;

  return (
    <>
      {groups.map((g, i) => (
        <div key={g[0]?.id}>
          <ProductGrid
            products={g}
            lang={lang}
            renderHeart={(p) => <WishlistHeart productId={p.id} lang={lang} />}
          />
          {g.length === every ? (
            <SpecialRow kind={rowKind(firstSlot + i)} lang={lang} recentTitle={labels.recent} />
          ) : null}
        </div>
      ))}
      <div className={s.more}>
        {done ? null : (
          <button type="button" ref={btn} className="btn btn-ghost" onClick={load} disabled={busy}>
            {busy ? labels.loading : labels.loadMore}
          </button>
        )}
        {failed ? (
          <p className={s.err} role="alert">
            {labels.error}
          </p>
        ) : null}
        <p className={s.count} aria-live="polite">
          {fmt(labels.showing, { n: formatNumber(total, lang) })}
        </p>
      </div>
    </>
  );
}
