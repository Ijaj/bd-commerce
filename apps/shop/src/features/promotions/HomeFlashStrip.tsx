import Link from 'next/link';
import { Icon } from '~/components/Icon';
import { ProductCard } from '~/components/ProductCard';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { fetchFlashSales } from './api';
import { Countdown } from './Countdown';
import s from './promotions.module.css';

const CARDS = 6;

/** Compact strip above the home feed: nearest-ending live sale, 6 cards. Renders nothing when none is live. */
export async function HomeFlashStrip({ lang }: { lang: Lang }) {
  const flash = await fetchFlashSales();
  const live = [...(flash?.live ?? [])].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
  const sale = live[0];
  if (!sale) return null;
  const t = dict(lang).promos.flash;
  // The same product can be on sale in several variants.
  const seen = new Set<string>();
  const cards = sale.items
    .map((i) => i.productCard)
    .filter((c) => !seen.has(c.id) && seen.add(c.id))
    .slice(0, CARDS);
  return (
    <section className={`wrap ${s.strip}`} aria-labelledby="h-flash">
      <div className={s.band}>
        <div className="sec-head">
          <h2 id="h-flash">{t.badge}</h2>
          <Countdown endsAt={sale.endsAt} lang={lang} className={s.boxed} />
          <Link className="link" href={href(lang, '/offers')}>
            {t.seeAll}
            <Icon name="chevR" size={16} />
          </Link>
        </div>
        <ul className={s.stripRow}>
          {cards.map((c) => (
            <li key={c.id}>
              <ProductCard product={c} lang={lang} sizes="160px" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
