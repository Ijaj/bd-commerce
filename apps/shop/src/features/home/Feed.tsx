import { connection } from 'next/server';
import { ProductGrid } from '~/components/ProductGrid';
import { EmptyState } from '~/components/States';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import { dict, type Lang } from '~/i18n';
import { getFeedPage } from './data';
import s from './Feed.module.css';
import { FeedMore } from './FeedMore';
import { chunk, FEED_LIMIT, rowKind } from './logic';
import { SpecialRow } from './SpecialRow';

/**
 * "Just for you" feed. A new random seed per request (Q16), so this is the only dynamic part of
 * the home page: it sits inside <Suspense> and streams in after the cached shell (carousel,
 * categories). Page 1 is server-rendered (cards in the HTML, no hydration cost, good LCP/SEO);
 * FeedMore takes over from `nextCursor` with the same seed.
 */
export async function Feed({ lang, every }: { lang: Lang; every: number }) {
  await connection();
  const d = dict(lang);
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const page = await getFeedPage(seed, FEED_LIMIT);

  const items = page?.items ?? [];
  if (page && items.length === 0) {
    return <EmptyState lang={lang} body={d.home.feedEmpty} />;
  }

  // Only whole groups are rendered here; the remainder moves to the client part so the next
  // special row lands after exactly `every` products.
  const whole = Math.floor(items.length / every) * every;
  const groups = chunk(items.slice(0, whole), every);
  const labels = {
    loadMore: d.home.loadMore,
    loading: d.home.loadingMore,
    showing: d.home.showing,
    error: d.home.feedError,
    recent: d.home.recent,
  };

  return (
    <>
      {groups.map((g, i) => (
        <div key={g[0]?.id}>
          <ProductGrid
            products={g}
            lang={lang}
            priorityCount={i === 0 ? 6 : 0}
            renderHeart={(p) => <WishlistHeart productId={p.id} lang={lang} />}
          />
          <SpecialRow kind={rowKind(i)} lang={lang} recentTitle={labels.recent} />
        </div>
      ))}
      <FeedMore
        seed={seed}
        cursor={page ? page.nextCursor : undefined}
        carry={items.slice(whole)}
        firstSlot={groups.length}
        shown={whole}
        every={every}
        lang={lang}
        labels={labels}
      />
    </>
  );
}

/** Shown while the feed streams in. */
export function FeedSkeleton({ lang }: { lang: Lang }) {
  return (
    <div className={s.more} role="status">
      <span className="sr-only">{dict(lang).common.loading}</span>
    </div>
  );
}
