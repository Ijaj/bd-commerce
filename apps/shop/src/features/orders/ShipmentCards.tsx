import { dict, fmt, type Lang } from '~/i18n';
import { localizeDigits } from '~/lib/format';
import { formatDateTime } from './format';
import s from './orders.module.css';
import type { OrderDetail } from './types';

type Shipment = OrderDetail['shipments'][number];

const BAD = ['failed', 'returning', 'returned'];

/** One card per live shipment: status, courier and tracking once handed over, the items inside. */
export function ShipmentCards({ lang, shipments }: { lang: Lang; shipments: Shipment[] }) {
  const d = dict(lang).orders;
  if (shipments.length === 0) return null;
  return (
    <section className={s.card} aria-labelledby="od-shipments">
      <h2 id="od-shipments" className={s.cardTitle}>
        {d.shipmentsTitle}
      </h2>
      <ul className={s.shipments}>
        {shipments.map((sh) => (
          <li key={sh.shipmentNo} className={s.shipment}>
            <div className={s.shipmentHead}>
              <strong>{fmt(d.shipmentNo, { no: localizeDigits(sh.shipmentNo, lang) })}</strong>
              <span className={`${s.badge} ${BAD.includes(sh.status) ? s.st_failed : ''}`}>
                {d.shipmentStatus[sh.status]}
              </span>
            </div>
            {sh.courier ? (
              <dl className={s.shipmentFacts}>
                <div className={s.row}>
                  <dt>{d.shipmentCourier}</dt>
                  <dd>{sh.courier.name}</dd>
                </div>
                {sh.trackingId ? (
                  <div className={s.row}>
                    <dt>{d.shipmentTrackingId}</dt>
                    <dd>{sh.trackingId}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {sh.handedAt ? (
              <p className={s.muted}>
                {fmt(d.shipmentHanded, { date: formatDateTime(sh.handedAt, lang) })}
              </p>
            ) : null}
            {sh.deliveredAt ? (
              <p className={s.muted}>
                {fmt(d.shipmentDelivered, { date: formatDateTime(sh.deliveredAt, lang) })}
              </p>
            ) : null}
            <ul className={s.shipmentItems}>
              {sh.items.map((it) => (
                <li key={`${it.title}-${it.qty}`} className={s.muted}>
                  {fmt(d.shipmentQty, { title: it.title, n: localizeDigits(it.qty, lang) })}
                </li>
              ))}
            </ul>
            {safeUrl(sh.trackingUrl) ? (
              <a
                className="btn btn-ghost btn-sm"
                href={safeUrl(sh.trackingUrl) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {d.shipmentTrack}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Courier links come from outside: only http(s) is opened. */
function safeUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
