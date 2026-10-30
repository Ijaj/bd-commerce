import { formatPrice } from '@bdc/i18n';
import { Alert, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { PageRule, PrintToolbar } from '~/features/documents/PrintShell';
import { dateLabel, optionText } from './logic';
import { poPrintQuery } from './queries';

const CSS = `
@page { size: A4; margin: 12mm; }
.po { position: relative; max-width: 190mm; margin: 0 auto; padding: 8mm; font-size: 12px; line-height: 1.45; }
.po h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
.po table { width: 100%; border-collapse: collapse; }
.po th, .po td { padding: 5px 6px; border-bottom: 1px solid var(--bdc-border); text-align: left; vertical-align: top; }
.po .num { text-align: right; white-space: nowrap; }
.po .cols { display: flex; gap: 24px; margin: 14px 0; }
.po .cols > div { flex: 1; }
.po .muted { color: var(--bdc-muted); }
.po .grand td { border-top: 1px solid var(--bdc-text); border-bottom: 0; font-size: 14px; }
.po .mark { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 110px; font-weight: 800; letter-spacing: 12px; color: rgba(0,0,0,.07); transform: rotate(-24deg); pointer-events: none; }
`;

export function PoPrintPage({ id }: { id: string }) {
  const q = useQuery(poPrintQuery(id));
  const d = q.data;
  return (
    <>
      <PrintToolbar disabled={!d} />
      {q.isLoading && <Loader m="lg" size="sm" />}
      {q.isError && (
        <Alert color="red" m="md">
          {q.error.message}
        </Alert>
      )}
      {d && (
        <div className="po">
          <PageRule css={CSS} />
          {d.po.status === 'draft' && <div className="mark">DRAFT</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1>PURCHASE ORDER</h1>
              <div>{d.store.name}</div>
              {d.store.address && <div className="muted">{d.store.address}</div>}
              {(d.store.phone || d.store.email) && (
                <div className="muted">
                  {[d.store.phone, d.store.email].filter(Boolean).join(' · ')}
                </div>
              )}
              {d.store.bin && <div className="muted">BIN: {d.store.bin}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>
                <b>{d.po.poNo}</b>
              </div>
              <div>Date: {dateLabel(d.po.sentAt ?? d.po.createdAt)}</div>
              <div>Expected: {dateLabel(d.po.expectedAt)}</div>
            </div>
          </div>
          <div className="cols">
            <div>
              <div className="muted">Supplier</div>
              <b>{d.supplier.name}</b>
              {d.supplier.contactName && <div>{d.supplier.contactName}</div>}
              {d.supplier.phone && <div>{d.supplier.phone}</div>}
              {d.supplier.email && <div>{d.supplier.email}</div>}
              {d.supplier.address && <div>{d.supplier.address}</div>}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th className="num">Qty</th>
                <th className="num">Unit cost</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((i) => (
                <tr key={i.sku}>
                  <td>{i.sku}</td>
                  <td>
                    {i.title}
                    {optionText(i.options)}
                  </td>
                  <td className="num">{i.qtyOrdered}</td>
                  <td className="num">{formatPrice(i.unitCostP, 'en')}</td>
                  <td className="num">{formatPrice(i.lineTotalP, 'en')}</td>
                </tr>
              ))}
              <tr className="grand">
                <td colSpan={4} className="num">
                  <b>Total (VAT-inclusive)</b>
                </td>
                <td className="num">
                  <b>{formatPrice(d.po.subtotalP, 'en')}</b>
                </td>
              </tr>
            </tbody>
          </table>
          {d.po.notes && (
            <div style={{ marginTop: 14 }}>
              <div className="muted">Notes</div>
              <div>{d.po.notes}</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
