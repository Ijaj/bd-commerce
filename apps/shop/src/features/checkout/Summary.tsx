'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Img } from '~/components/Img';
import type { Cart } from '~/features/cart/types';
import { dict, fmt, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice, localizeDigits } from '~/lib/format';
import s from './checkout.module.css';
import { etaText } from './eta';
import type { Quote } from './types';

/** Order summary: items, money breakdown from the live quote, then the action (place button). */
export function Summary({
  lang,
  cart,
  quote,
  quoting,
  children,
}: {
  lang: Lang;
  cart: Cart;
  quote: Quote | null;
  quoting: boolean;
  children: ReactNode;
}) {
  const d = dict(lang).checkout;
  const subtotal = quote?.subtotalP ?? cart.subtotalP;
  const total = quote?.grandTotalP ?? cart.subtotalP;
  return (
    <aside className={s.summary} aria-labelledby="co-sum">
      <div className={s.sumHead}>
        <h2 id="co-sum" className={s.cardTitle}>
          {d.summary}
        </h2>
        <Link className="link" href={href(lang, '/cart')}>
          {d.editCart}
        </Link>
      </div>
      <ul className={s.items}>
        {cart.items.map((l) => (
          <li key={l.variantId} className={s.item}>
            <span className={s.itemImg}>
              <Img image={l.image} sizes="48px" alt="" />
            </span>
            <span className={s.itemText}>
              <span>{pick(lang, l.titleEn, l.titleBn)}</span>
              <span className={s.muted}>
                {[
                  pick(lang, l.optionsTextEn ?? '', l.optionsTextBn),
                  `× ${localizeDigits(l.qty, lang)}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </span>
            </span>
            <span>{formatPrice(l.unitPriceP * l.qty, lang)}</span>
          </li>
        ))}
      </ul>
      <dl className={s.rows} aria-busy={quoting || undefined}>
        <div className={s.row}>
          <dt>{d.subtotal}</dt>
          <dd>{formatPrice(subtotal, lang)}</dd>
        </div>
        <div className={s.row}>
          <dt>{d.delivery}</dt>
          <dd>
            {quote ? (
              formatPrice(quote.deliveryChargeP, lang)
            ) : (
              <span className={s.muted}>{quoting ? d.quoting : d.deliveryPick}</span>
            )}
          </dd>
        </div>
        {quote && quote.deliveryDiscountP > 0 ? (
          <div className={s.row}>
            <dt>{d.discount}</dt>
            <dd className={s.good}>−{formatPrice(quote.deliveryDiscountP, lang)}</dd>
          </div>
        ) : null}
        <div className={`${s.row} ${s.totalRow}`}>
          <dt>{d.total}</dt>
          <dd>{formatPrice(total, lang)}</dd>
        </div>
        <div className={s.row}>
          <dt>{d.payOnDelivery}</dt>
          <dd>{formatPrice(total, lang)}</dd>
        </div>
      </dl>
      {quote ? (
        <>
          <p className={s.muted}>
            {fmt(d.eta, { range: etaText(lang, quote.zone.etaMinDays, quote.zone.etaMaxDays) })}
          </p>
          {quote.freeDeliveryRemainingP !== null && quote.freeDeliveryRemainingP > 0 ? (
            <p className={s.hintGood}>
              {fmt(d.freeMore, { amt: formatPrice(quote.freeDeliveryRemainingP, lang) })}
            </p>
          ) : null}
        </>
      ) : null}
      {children}
    </aside>
  );
}
