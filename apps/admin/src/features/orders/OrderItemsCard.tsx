import { SectionCard } from '@bdc/ui';
import { formatPrice } from '~/lib/format';
import classes from './Orders.module.css';
import type { OrderDetail } from './queries';

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'neg' | 'dim' | 'grand';
}) {
  const cls = tone ? classes[tone] : undefined;
  return (
    <>
      <span className={cls}>{label}</span>
      <span className={`${classes.num} ${cls ?? ''}`}>{value}</span>
    </>
  );
}

/** Line items with fulfilment counters, then the money breakdown (`.s-item` rows + `.s-totals`). */
export function OrderItemsCard({ order }: { order: OrderDetail }) {
  const m = order.money;
  return (
    <SectionCard title="Items">
      {order.items.map((i) => (
        <div key={i.id} className={classes.item}>
          <div className={classes.thumb}>
            {i.image && <img src={i.image.url320} alt={i.image.alt ?? ''} width={40} height={40} />}
          </div>
          <div>
            <div className={classes.itemTitle}>{i.titleSnapshot}</div>
            <div className={`${classes.muted} ${classes.small}`}>
              {[i.optionsText, i.sku].filter(Boolean).join(' · ')}
            </div>
            <div className={`${classes.muted} ${classes.small}`}>
              {[
                `${i.qtyShipped} shipped`,
                i.qtyCancelled > 0 && `${i.qtyCancelled} cancelled`,
                i.qtyReturned > 0 && `${i.qtyReturned} returned`,
              ]
                .filter(Boolean)
                .join(', ')}
            </div>
          </div>
          <div className={classes.itemPrice}>
            {i.qty} × {formatPrice(i.unitPriceP)}
            <div className={`${classes.muted} ${classes.small}`}>{formatPrice(i.lineTotalP)}</div>
          </div>
        </div>
      ))}
      <div className={classes.totals}>
        <Row label="Subtotal" value={formatPrice(m.subtotalP)} />
        {m.autoDiscountP > 0 && (
          <Row label="Discount" value={`-${formatPrice(m.autoDiscountP)}`} tone="neg" />
        )}
        {m.couponDiscountP > 0 && (
          <Row label="Coupon" value={`-${formatPrice(m.couponDiscountP)}`} tone="neg" />
        )}
        <Row label="Delivery" value={formatPrice(m.deliveryChargeP)} />
        {m.deliveryDiscountP > 0 && (
          <Row
            label="Delivery discount"
            value={`-${formatPrice(m.deliveryDiscountP)}`}
            tone="neg"
          />
        )}
        <Row label="Total" value={formatPrice(m.grandTotalP)} tone="grand" />
        <Row label="Paid" value={formatPrice(m.paidP)} tone="dim" />
        {m.refundedP > 0 && <Row label="Refunded" value={formatPrice(m.refundedP)} tone="dim" />}
        <Row label="Cash on delivery due" value={formatPrice(m.codDueP)} />
      </div>
    </SectionCard>
  );
}
