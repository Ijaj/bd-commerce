import Link from 'next/link';
import { formatDateTime } from '~/features/orders/format';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatNumber, formatPrice, localizeDigits } from '~/lib/format';
import s from './invoice.module.css';
import { PrintButton } from './PrintButton';
import type { InvoiceDetail } from './types';

// The site shell (header, footer, bars) is siblings of <main>; hide them and the toolbar when printing.
const PRINT_CSS = `@page{size:A4;margin:14mm}@media print{body>:not(main){display:none!important}body{background:#fff}main{padding:0!important}}`;

/** Customer invoice from the API's print JSON. Prices include VAT; EN/BN follows the page language. */
export function InvoiceView({ lang, inv }: { lang: Lang; inv: InvoiceDetail }) {
  const d = dict(lang).returns.inv;
  const sn = inv.snapshot;
  const other: Lang = lang === 'bn' ? 'en' : 'bn';
  const p = (n: number) => formatPrice(n, lang);
  const num = (n: number | string) => localizeDigits(n, lang);
  const rate = `${formatNumber(sn.vat.rateBp / 100, lang)}%`;

  return (
    <div className={s.wrap}>
      <style>{PRINT_CSS}</style>
      <div className={s.toolbar}>
        <Link className="link" href={href(lang, `/account/orders/${inv.orderNo}`)}>
          {d.back}
        </Link>
        <span className={s.toolbarEnd}>
          <Link
            className="btn btn-ghost btn-sm"
            href={href(other, `/order/${inv.orderNo}/invoice`)}
          >
            {other === 'bn' ? 'বাংলা' : 'English'}
          </Link>
          <PrintButton label={d.print} />
        </span>
      </div>

      <article className={s.sheet} aria-label={fmt(d.title, { no: num(inv.invoiceNo) })}>
        <header className={s.head}>
          <div>
            <h1 className={s.title}>{sn.store.name}</h1>
            <p>{sn.store.address}</p>
            <p>
              {sn.store.phone} · {sn.store.email}
            </p>
            {sn.store.bin ? (
              <p>
                {d.bin}: {num(sn.store.bin)}
              </p>
            ) : null}
          </div>
          <dl className={s.meta}>
            <div>
              <dt>{d.taxInvoice}</dt>
              <dd>{num(inv.invoiceNo)}</dd>
            </div>
            <div>
              <dt>{d.order}</dt>
              <dd>{num(inv.orderNo)}</dd>
            </div>
            <div>
              <dt>{d.date}</dt>
              <dd>{formatDateTime(inv.issuedAt, lang)}</dd>
            </div>
            <div>
              <dt>{d.payment}</dt>
              <dd>{sn.paymentMethod === 'cod' ? d.cod : sn.paymentMethod}</dd>
            </div>
          </dl>
        </header>

        <div className={s.parties}>
          <section aria-labelledby="inv-bill">
            <h2 id="inv-bill" className={s.sub}>
              {d.billTo}
            </h2>
            <p>{sn.billTo.name}</p>
            {sn.billTo.phone ? <p>{sn.billTo.phone}</p> : null}
            {sn.billTo.email ? <p>{sn.billTo.email}</p> : null}
          </section>
          <section aria-labelledby="inv-ship">
            <h2 id="inv-ship" className={s.sub}>
              {d.shipTo}
            </h2>
            <p>{sn.shipTo.name}</p>
            <p>{sn.shipTo.phone}</p>
            <p>{sn.shipTo.address}</p>
            <p>{sn.shipTo.placeText}</p>
          </section>
        </div>

        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">{d.item}</th>
              <th scope="col" className={s.num}>
                {d.unitPrice}
              </th>
              <th scope="col" className={s.num}>
                {d.qty}
              </th>
              <th scope="col" className={s.num}>
                {d.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {sn.lines.map((l) => (
              <tr key={`${l.sku}-${l.optionsText ?? ''}`}>
                <td>
                  {l.titleSnapshot}
                  {l.optionsText ? <span className={s.muted}> · {l.optionsText}</span> : null}
                  <span className={s.muted}> · {l.sku}</span>
                </td>
                <td className={s.num}>{p(l.unitPriceP)}</td>
                <td className={s.num}>{num(l.qty)}</td>
                <td className={s.num}>{p(l.lineTotalP)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className={s.totals}>
          <Row label={d.subtotal} value={p(sn.subtotalP)} />
          {sn.autoDiscountP > 0 ? (
            <Row label={d.discount} value={`−${p(sn.autoDiscountP)}`} />
          ) : null}
          {sn.couponDiscountP > 0 ? (
            <Row label={d.coupon} value={`−${p(sn.couponDiscountP)}`} />
          ) : null}
          <Row label={d.delivery} value={p(sn.deliveryChargeP)} />
          {sn.deliveryDiscountP > 0 ? (
            <Row label={d.deliveryDiscount} value={`−${p(sn.deliveryDiscountP)}`} />
          ) : null}
          <Row label={d.grandTotal} value={p(sn.grandTotalP)} strong />
          {sn.paidP > 0 ? <Row label={d.paid} value={p(sn.paidP)} /> : null}
          <Row label={d.codDue} value={p(sn.codDueP)} />
        </dl>

        <p className={s.muted}>
          {fmt(d.vatNote, { rate, vat: p(sn.vat.totalP), net: p(sn.vat.netP) })}
        </p>
        <p className={s.muted}>{d.thanks}</p>
      </article>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? s.grand : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
