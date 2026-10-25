import { ProductCard } from '~/components/ProductCard';
import { dict, fmt, type Lang, pick } from '~/i18n';
import { localizeDigits } from '~/lib/format';
import { Countdown } from './Countdown';
import { lowFlash } from './logic';
import s from './promotions.module.css';
import type { FlashSale } from './types';

/** One flash sale: name, countdown (to end, or to start for upcoming) and its product cards. */
export function FlashSaleBlock({
  sale,
  lang,
  upcoming = false,
  max,
}: {
  sale: FlashSale;
  lang: Lang;
  upcoming?: boolean;
  max?: number;
}) {
  const t = dict(lang).promos;
  const name = pick(lang, sale.nameEn, sale.nameBn);
  const items = max ? sale.items.slice(0, max) : sale.items;
  return (
    <section className={s.section} aria-label={name}>
      <div className={s.saleHead}>
        <h2 className={s.sectionTitle}>{name}</h2>
        <Countdown
          endsAt={upcoming ? sale.startsAt : sale.endsAt}
          lang={lang}
          mode={upcoming ? 'starts' : 'ends'}
        />
      </div>
      <ul className={s.cards}>
        {items.map((it) => (
          <li key={it.variantId}>
            <ProductCard
              product={it.productCard}
              lang={lang}
              sizes="(max-width: 640px) 50vw, 200px"
            />
            {!upcoming && lowFlash(it.remaining) ? (
              <p className={s.flashLow}>
                {fmt(t.offers.leftOf, { n: localizeDigits(it.remaining, lang) })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
