import { formatPrice, type Lang, localizeDigits } from '@bdc/i18n';
import { INVOICE_TEXT, invoiceDate, vatPercent } from './invoice-text';
import { PageRule } from './PrintShell';
import type { InvoiceDetail } from './queries';

const CSS = `
@page { size: A4; margin: 12mm; }
.invoice { max-width: 190mm; margin: 0 auto; padding: 8mm; font-size: 12px; line-height: 1.45; }
.invoice h1 { font-size: 22px; margin: 0 0 4px; }
.invoice table { width: 100%; border-collapse: collapse; }
.invoice th, .invoice td { padding: 5px 6px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
.invoice .num { text-align: right; white-space: nowrap; }
.invoice .cols { display: flex; gap: 24px; margin: 14px 0; }
.invoice .cols > div { flex: 1; }
.invoice .totals { margin-left: auto; width: 60%; margin-top: 10px; }
.invoice .totals td { border: 0; padding: 2px 6px; }
.invoice .grand td { border-top: 1px solid #111; font-size: 14px; }
.invoice .muted { color: #555; }
`;

/** Customer-facing A4 invoice from the stored snapshot. Order/phone/invoice numbers keep English digits. */
export function InvoiceView({ invoice, lang }: { invoice: InvoiceDetail; lang: Lang }) {
  const t = INVOICE_TEXT[lang];
  const s = invoice.snapshot;
  const money = (p: number) => formatPrice(p, lang);
  const n = (v: number) => localizeDigits(v, lang);
  const method = s.paymentMethod === 'cod' ? t.cod : s.paymentMethod;

  return (
    <div className="invoice" lang={lang}>
      <PageRule css={CSS} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1>{t.title}</h1>
          <div>{s.store.name}</div>
          <div className="muted">{s.store.address}</div>
          <div className="muted">
            {s.store.phone} · {s.store.email}
          </div>
          {s.store.bin && (
            <div className="muted">
              {t.bin}: {s.store.bin}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>
            {t.invoiceNo}: {invoice.invoiceNo}
          </div>
          <div>
            {t.orderNo}: {s.orderNo}
          </div>
          <div>
            {t.date}: {invoiceDate(invoice.issuedAt, lang)}
          </div>
          <div>
            {t.payment}: {method}
          </div>
        </div>
      </div>

      <div className="cols">
        <div>
          <div className="muted">{t.billTo}</div>
          <div>{s.billTo.name}</div>
          {s.billTo.phone && <div>{s.billTo.phone}</div>}
          {s.billTo.email && <div>{s.billTo.email}</div>}
        </div>
        <div>
          <div className="muted">{t.shipTo}</div>
          <div>{s.shipTo.name}</div>
          <div>{s.shipTo.phone}</div>
          <div>{s.shipTo.address}</div>
          <div>{s.shipTo.placeText}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>{t.item}</th>
            <th className="num">{t.qty}</th>
            <th className="num">{t.unit}</th>
            <th className="num">{t.total}</th>
          </tr>
        </thead>
        <tbody>
          {s.lines.map((l) => (
            <tr key={`${l.sku}-${l.titleSnapshot}`}>
              <td>
                {l.titleSnapshot}
                <div className="muted">
                  {l.sku}
                  {l.optionsText ? ` · ${l.optionsText}` : ''}
                </div>
              </td>
              <td className="num">{n(l.qty)}</td>
              <td className="num">{money(l.unitPriceP)}</td>
              <td className="num">{money(l.lineTotalP)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals">
        <tbody>
          <Row label={t.subtotal} value={money(s.subtotalP)} />
          {s.autoDiscountP > 0 && <Row label={t.discount} value={`-${money(s.autoDiscountP)}`} />}
          {s.couponDiscountP > 0 && <Row label={t.coupon} value={`-${money(s.couponDiscountP)}`} />}
          <Row label={t.delivery} value={money(s.deliveryChargeP)} />
          {s.deliveryDiscountP > 0 && (
            <Row label={t.deliveryDiscount} value={`-${money(s.deliveryDiscountP)}`} />
          )}
          <Row label={t.grand} value={money(s.grandTotalP)} className="grand" />
          <Row label={`${t.net}`} value={money(s.vat.netP)} className="muted" />
          <Row
            label={`${t.vat} (${vatPercent(s.vat.rateBp, lang)})`}
            value={money(s.vat.totalP)}
            className="muted"
          />
          {s.paidP > 0 && <Row label={t.paid} value={money(s.paidP)} />}
          <Row label={t.due} value={money(s.codDueP)} />
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 18 }}>
        {t.vatNote} {t.thanks}
      </p>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <tr className={className}>
      <td>{label}</td>
      <td className="num">{value}</td>
    </tr>
  );
}
