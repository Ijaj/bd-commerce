import Link from 'next/link';
import { Img } from '~/components/Img';
import { etaText } from '~/features/checkout/eta';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice, localizeDigits } from '~/lib/format';
import { formatDateTime } from './format';
import s from './orders.module.css';
import { Timeline } from './Timeline';
import type { OrderDetail } from './types';

/** Full order for the logged-in customer: items, money, ship-to, status timeline. */
export function OrderDetailView({ lang, o }: { lang: Lang; o: OrderDetail }) {
  const d = dict(lang).orders;
  const m = o.money;
  const paymentStatuses = d.paymentStatuses as Record<string, string>;
  return (
    <div className={s.detail}>
      <div className={s.detailHead}>
        <div>
          <h1 className="page-title">
            {fmt(d.orderTitle, { no: localizeDigits(o.orderNo, lang) })}
          </h1>
          <p className={s.muted}>{fmt(d.placedOn, { date: formatDateTime(o.placedAt, lang) })}</p>
        </div>
        <span className={`${s.badge} ${s[`st_${o.status}`] ?? ''}`}>{d.status[o.status]}</span>
      </div>

      <div className={s.cols}>
        <div className={s.colMain}>
          <section className={s.card} aria-labelledby="od-status">
            <h2 id="od-status" className={s.cardTitle}>
              {d.timeline}
            </h2>
            <Timeline lang={lang} steps={o.history} />
            {o.status === 'processing' ? (
              <p className={s.muted}>
                {fmt(d.eta, { range: etaText(lang, o.zone.etaMinDays, o.zone.etaMaxDays) })}
              </p>
            ) : null}
          </section>

          <section className={s.card} aria-labelledby="od-items">
            <h2 id="od-items" className={s.cardTitle}>
              {d.items}
            </h2>
            <ul className={s.items}>
              {o.items.map((it) => (
                <li key={`${it.variantId}`} className={s.item}>
                  <Link
                    className={s.thumb}
                    href={href(lang, `/p/${it.slug}`)}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Img image={it.image} sizes="64px" alt="" />
                  </Link>
                  <span className={s.itemText}>
                    <Link className={s.itemName} href={href(lang, `/p/${it.slug}`)}>
                      {it.title}
                    </Link>
                    {it.optionsText ? <span className={s.muted}>{it.optionsText}</span> : null}
                    <span className={s.muted}>
                      {d.qty}: {localizeDigits(it.qty, lang)} × {formatPrice(it.unitPriceP, lang)}
                      {it.qtyCancelled > 0
                        ? ` (${fmt(d.cancelledQty, { n: localizeDigits(it.qtyCancelled, lang) })})`
                        : ''}
                    </span>
                  </span>
                  <span>{formatPrice(it.lineTotalP, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={s.colSide}>
          <section className={s.card} aria-labelledby="od-sum">
            <h2 id="od-sum" className={s.cardTitle}>
              {d.summary}
            </h2>
            <dl className={s.rows}>
              <Row label={d.subtotal} value={formatPrice(m.subtotalP, lang)} />
              {m.autoDiscountP > 0 ? (
                <Row label={d.discount} value={`−${formatPrice(m.autoDiscountP, lang)}`} />
              ) : null}
              {m.couponDiscountP > 0 ? (
                <Row label={d.coupon} value={`−${formatPrice(m.couponDiscountP, lang)}`} />
              ) : null}
              <Row label={d.delivery} value={formatPrice(m.deliveryChargeP, lang)} />
              {m.deliveryDiscountP > 0 ? (
                <Row
                  label={d.deliveryDiscount}
                  value={`−${formatPrice(m.deliveryDiscountP, lang)}`}
                />
              ) : null}
              <Row label={d.total} value={formatPrice(m.grandTotalP, lang)} total />
              {m.paidP > 0 ? <Row label={d.paid} value={formatPrice(m.paidP, lang)} /> : null}
              {m.refundedP > 0 ? (
                <Row label={d.refunded} value={formatPrice(m.refundedP, lang)} />
              ) : null}
              <Row label={d.codDue} value={formatPrice(m.codDueP, lang)} />
            </dl>
            <p className={s.muted}>
              {d.payment}: {o.paymentMethod === 'cod' ? d.paymentCod : o.paymentMethod} ·{' '}
              {paymentStatuses[o.paymentStatus] ?? o.paymentStatus}
            </p>
          </section>

          <section className={s.card} aria-labelledby="od-ship">
            <h2 id="od-ship" className={s.cardTitle}>
              {d.shipTo}
            </h2>
            <address className={s.address}>
              <span>{o.shipTo.name}</span>
              <span>{o.shipTo.phone}</span>
              <span>{o.shipTo.line}</span>
              <span>{o.shipTo.placeText}</span>
              {o.shipTo.landmark ? (
                <span className={s.muted}>{fmt(d.landmark, { text: o.shipTo.landmark })}</span>
              ) : null}
            </address>
            {o.customerNote ? (
              <p className={s.muted}>
                {d.note}: {o.customerNote}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <p>
        <Link className="link" href={href(lang, '/account/orders')}>
          {d.back}
        </Link>
      </p>
    </div>
  );
}

function Row({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <div className={`${s.row} ${total ? s.totalRow : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
