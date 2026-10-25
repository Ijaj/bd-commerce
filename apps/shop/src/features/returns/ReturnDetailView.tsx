import Link from 'next/link';
import { formatDateTime } from '~/features/orders/format';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice, localizeDigits } from '~/lib/format';
import { returnSteps } from './logic';
import s from './returns.module.css';
import type { CustomerReturn } from './types';

/** One return: status progress, items with reasons, fault/shipping note, linked refunds. */
export function ReturnDetailView({ lang, r }: { lang: Lang; r: CustomerReturn }) {
  const d = dict(lang).returns;
  const steps = returnSteps(r.status);
  return (
    <div className={s.detail}>
      <div className={s.detailHead}>
        <div>
          <h1 className="page-title">
            {fmt(d.returnTitle, { no: localizeDigits(r.returnNo, lang) })}
          </h1>
          <p className={s.muted}>
            <Link className="link" href={href(lang, `/account/orders/${r.orderNo}`)}>
              {fmt(d.forOrder, { no: localizeDigits(r.orderNo, lang) })}
            </Link>{' '}
            · {fmt(d.requestedOn, { date: formatDateTime(r.requestedAt, lang) })}
          </p>
        </div>
        <span className={`${s.badge} ${s[`st_${r.status}`] ?? ''}`}>{d.status[r.status]}</span>
      </div>

      <section className={s.card} aria-labelledby="rt-prog">
        <h2 id="rt-prog" className={s.cardTitle}>
          {d.progress}
        </h2>
        <ol className={s.steps}>
          {steps.map((st) => (
            <li key={st.status} className={s[`step_${st.state}`]}>
              <span className={s.dot} aria-hidden="true" />
              <span>{d.status[st.status]}</span>
              {st.state === 'current' ? (
                <span className="sr-only"> ({d.status[st.status]})</span>
              ) : null}
            </li>
          ))}
        </ol>
        <p>{d.statusHint[r.status]}</p>
        {r.status === 'rejected' && r.rejectReason ? (
          <p className={s.muted}>{fmt(d.rejectedReason, { text: r.rejectReason })}</p>
        ) : null}
        {r.fault ? <p className={s.muted}>{d.fault[r.fault]}</p> : null}
        {r.returnShippingP > 0 ? (
          <p className={s.muted}>
            {fmt(d.shipping, { amount: formatPrice(r.returnShippingP, lang) })}
          </p>
        ) : null}
      </section>

      <section className={s.card} aria-labelledby="rt-items">
        <h2 id="rt-items" className={s.cardTitle}>
          {d.itemsTitle}
        </h2>
        <ul className={s.items}>
          {r.items.map((it) => (
            <li key={it.orderItemId}>
              <span>{it.titleSnapshot}</span>
              {it.optionsText ? <span className={s.muted}> · {it.optionsText}</span> : null}
              <span className={s.muted}>
                {d.qty}: {localizeDigits(it.qty, lang)} · {d.reasons[it.reason]}
                {it.note ? ` · ${it.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {r.refunds.length > 0 ? (
        <section className={s.card} aria-labelledby="rt-ref">
          <h2 id="rt-ref" className={s.cardTitle}>
            {d.refundsTitle}
          </h2>
          <ul className={s.items}>
            {r.refunds.map((f) => (
              <li key={f.id}>
                <span>{formatPrice(f.amountP, lang)}</span>
                <span className={s.muted}>
                  {d.refundMethod[f.method]} · {d.refundStatus[f.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p>
        <Link className="link" href={href(lang, '/account/returns')}>
          {d.back}
        </Link>
      </p>
    </div>
  );
}
