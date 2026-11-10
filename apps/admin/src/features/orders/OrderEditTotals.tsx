import { Banner } from '@bdc/ui';
import { Badge } from '@mantine/core';
import { formatPrice } from '~/lib/format';
import classes from './Orders.module.css';
import type { EditPreview } from './queries';

const CHANGE: Record<
  EditPreview['lines'][number]['change'],
  { label: string; color: string } | null
> = {
  same: null,
  qty: { label: 'Qty changed', color: 'blue' },
  price: { label: 'Added at today price', color: 'yellow' },
  added: { label: 'New', color: 'green' },
  removed: { label: 'Removed', color: 'red' },
};

const ROWS: { key: keyof EditPreview['money']; label: string; neg?: boolean }[] = [
  { key: 'subtotalP', label: 'Subtotal' },
  { key: 'autoDiscountP', label: 'Discount', neg: true },
  { key: 'couponDiscountP', label: 'Coupon', neg: true },
  { key: 'deliveryChargeP', label: 'Delivery' },
  { key: 'deliveryDiscountP', label: 'Delivery discount', neg: true },
  { key: 'grandTotalP', label: 'Total' },
  { key: 'codDueP', label: 'Cash on delivery due' },
];

/** The preview: lines as they will be stored, then old vs new money, then warnings. */
export function OrderEditTotals({ preview }: { preview: EditPreview }) {
  return (
    <div data-testid="edit-preview">
      <table className="a-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Line</th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((l) => {
            const tag = CHANGE[l.change];
            return (
              <tr key={`${l.orderItemId ?? 'new'}-${l.variantId}-${l.unitPriceP}-${l.change}`}>
                <td className={l.change === 'removed' ? classes.struck : undefined}>
                  {l.title}
                  {l.optionsText ? ` (${l.optionsText})` : ''}{' '}
                  {tag && (
                    <Badge size="xs" color={tag.color}>
                      {tag.label}
                    </Badge>
                  )}
                </td>
                <td className="num">{l.qty}</td>
                <td className="num">{formatPrice(l.unitPriceP)}</td>
                <td className="num">{formatPrice(l.lineTotalP)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className={`a-table ${classes.compare}`}>
        <thead>
          <tr>
            <th />
            <th className="num">Now</th>
            <th className="num">After edit</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const was = preview.before[r.key];
            const now = preview.money[r.key];
            if (r.neg && was === 0 && now === 0) return null;
            const sign = r.neg ? '-' : '';
            return (
              <tr key={r.key} className={now !== was ? classes.changedRow : undefined}>
                <td>{r.label}</td>
                <td className="num">{`${sign}${formatPrice(was)}`}</td>
                <td className="num">
                  <b>{`${sign}${formatPrice(now)}`}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={`${classes.muted} ${classes.small}`}>Delivery zone: {preview.zone.name}</div>
      {preview.warnings.map((w) => (
        <Banner key={w} tone="warn">
          {w}
        </Banner>
      ))}
    </div>
  );
}
