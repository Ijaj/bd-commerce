import { Banner, SectionCard } from '@bdc/ui';
import { formatDateTime, formatPrice } from '~/lib/format';
import type { EditMode } from './logic';
import { optionText } from './logic';
import css from './PurchaseOrders.module.css';
import type { PoDetail } from './queries';

/** Read-only lines with received / rejected / remaining, once the PO is sent. */
export function PoLinesReadOnly({ po }: { po: PoDetail }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            <th className={css.productCol}>Product</th>
            <th className="num">Ordered</th>
            <th className="num">Received</th>
            <th className="num">Rejected</th>
            <th className="num">Remaining</th>
            <th className="num">Unit cost</th>
            <th className="num">Line total</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((i) => (
            <tr key={i.id}>
              <td>
                {i.productTitleEn}
                {optionText(i.options)}
                <span className="sub">{i.sku}</span>
              </td>
              <td className="num">{i.qtyOrdered}</td>
              <td className="num">{i.qtyReceived}</td>
              <td className="num">{i.qtyRejected}</td>
              <td className="num">{i.remaining}</td>
              <td className="num">{formatPrice(i.unitCostP)}</td>
              <td className="num">{formatPrice(i.lineTotalP)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="num">
              <b>Total (cost, VAT-inclusive)</b>
            </td>
            <td className="num">
              <b>{formatPrice(po.subtotalP)}</b>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Every receipt: when, who, note, per-line good / rejected and the cost change. */
export function PoReceipts({ po }: { po: PoDetail }) {
  if (po.receipts.length === 0) return null;
  const names = new Map(po.items.map((i) => [i.id, `${i.productTitleEn}${optionText(i.options)}`]));
  return (
    <SectionCard title="Receipts" flush>
      {po.receipts.map((r) => (
        <div key={r.id} style={{ padding: '12px 14px', borderTop: '1px solid var(--bdc-border)' }}>
          <div style={{ marginBottom: 6 }}>
            <b>{formatDateTime(r.at)}</b> · {r.receivedBy.name} · worth {formatPrice(r.totalP)}
            {r.note && (
              <div style={{ color: 'var(--bdc-muted)', fontSize: 12, marginTop: 2 }}>{r.note}</div>
            )}
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th className={css.productCol}>Product</th>
                  <th className="num">Good</th>
                  <th className="num">Rejected</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Average cost</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it) => (
                  <tr key={it.poItemId}>
                    <td>
                      {names.get(it.poItemId) ?? it.sku}
                      <span className="sub">{it.sku}</span>
                    </td>
                    <td className="num">{it.qtyGood}</td>
                    <td className="num">{it.qtyRejected}</td>
                    <td className="num">{formatPrice(it.unitCostP)}</td>
                    <td className="num">
                      {it.costAfterP === null
                        ? '-'
                        : it.costBeforeP === null || it.costBeforeP === it.costAfterP
                          ? formatPrice(it.costAfterP)
                          : `${formatPrice(it.costBeforeP)} → ${formatPrice(it.costAfterP)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

/** Status banners above the order card: closed short, cancelled, and why the form is locked. */
export function PoBanners({ po, mode }: { po: PoDetail | null; mode: EditMode }) {
  return (
    <>
      {po?.status === 'closed' && (
        <Banner tone="info" icon="lock">
          Closed short{po.closedBy ? ` by ${po.closedBy.name}` : ''}: {po.closeReason}. The
          remaining quantity was dropped and nothing more is owed for it.
        </Banner>
      )}
      {po?.status === 'cancelled' && (
        <Banner tone="danger">Cancelled{po.closeReason ? `: ${po.closeReason}` : ''}.</Banner>
      )}
      {mode === 'none' && po?.status === 'draft' && (
        <Banner tone="info" icon="lock">
          You need the suppliers.manage permission to edit purchase orders.
        </Banner>
      )}
      {mode === 'meta' && (
        <Banner tone="info" icon="lock">
          This order was sent, so its lines are locked. You can still change the expected date and
          notes.
        </Banner>
      )}
    </>
  );
}
