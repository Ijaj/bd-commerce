'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '~/components/Icon';
import { DiscountList } from '~/features/promotions/DiscountList';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice } from '~/lib/format';
import s from './checkout.module.css';
import { type PlacedOrder, recallPlaced } from './errors';
import { etaText } from './eta';

/**
 * Thank-you page. Logged-in customers get the order from the API (`server`); a guest cannot, so
 * the numbers come from the short-lived sessionStorage entry written when the order was placed.
 * Without either (a stale link, another browser) it falls back to a tracking prompt.
 */
export function SuccessView({
  lang,
  orderNo,
  server,
  loggedIn,
}: {
  lang: Lang;
  orderNo: string;
  server: PlacedOrder | null;
  loggedIn: boolean;
}) {
  const d = dict(lang).checkout.success;
  const [order, setOrder] = useState<PlacedOrder | null>(server);
  const [checked, setChecked] = useState(server !== null);

  useEffect(() => {
    if (!server) setOrder(recallPlaced(orderNo));
    setChecked(true);
  }, [server, orderNo]);

  if (!checked) return <div className="wrap page" aria-busy="true" />;

  if (!order) {
    return (
      <div className="wrap page">
        <div className={s.done}>
          <h1 className="page-title">{d.unknownTitle}</h1>
          <p>{d.unknownBody}</p>
          <div className={s.actions}>
            <Link
              className="btn btn-primary"
              href={`${href(lang, '/track')}?order=${encodeURIComponent(orderNo)}`}
            >
              {d.trackLink}
            </Link>
            {loggedIn ? (
              <Link className="btn btn-ghost" href={href(lang, '/account/orders')}>
                {d.myOrders}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const eta =
    order.etaMinDays !== null && order.etaMaxDays !== null
      ? etaText(lang, order.etaMinDays, order.etaMaxDays)
      : null;

  return (
    <div className="wrap page">
      <div className={s.done}>
        <span className={s.tick} aria-hidden="true">
          <Icon name="check" size={30} />
        </span>
        <h1 className="page-title" role="status">
          {d.title}
        </h1>
        <p>{d.intro}</p>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>{d.orderNo}</dt>
            <dd>{order.orderNo}</dd>
          </div>
          <div className={s.fact}>
            <dt>{d.total}</dt>
            <dd>{formatPrice(order.grandTotalP, lang)}</dd>
          </div>
          <div className={s.fact}>
            <dt>{d.codDue}</dt>
            <dd>{formatPrice(order.codDueP, lang)}</dd>
          </div>
          {eta ? (
            <div className={s.fact}>
              <dt>{d.eta}</dt>
              <dd>{eta}</dd>
            </div>
          ) : null}
        </dl>
        <DiscountList rows={order.discounts ?? []} lang={lang} />
        {loggedIn ? null : <p className={s.muted}>{d.saveNumber}</p>}
        <section aria-labelledby="co-next">
          <h2 id="co-next" className={s.cardTitle}>
            {d.next}
          </h2>
          <ol className={s.steps}>
            <li>{d.step1}</li>
            <li>{d.step2}</li>
            <li>{fmt(d.step3, { amt: formatPrice(order.codDueP, lang) })}</li>
          </ol>
        </section>
        <div className={s.actions}>
          <Link
            className="btn btn-primary"
            href={
              loggedIn
                ? href(lang, `/account/orders/${order.orderNo}`)
                : `${href(lang, '/track')}?order=${encodeURIComponent(order.orderNo)}`
            }
          >
            {d.track}
          </Link>
          <Link className="btn btn-ghost" href={href(lang, '/')}>
            {d.continue}
          </Link>
        </div>
        {loggedIn ? null : (
          <p className={s.accCta}>
            {d.guestHint}{' '}
            <Link className="link" href={href(lang, '/signup')}>
              {d.signup}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
