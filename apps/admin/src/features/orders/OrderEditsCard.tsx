import { SectionCard } from '@bdc/ui';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, formatPrice } from '~/lib/format';
import { describeEdit } from './edit-logic';
import classes from './Orders.module.css';
import { editsQuery } from './queries';

/** Edit history on the order page; absent until the order has been edited. */
export function OrderEditsCard({ orderId }: { orderId: string }) {
  const q = useQuery(editsQuery(orderId));
  const items = q.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <SectionCard title="Edit history">
      {items.map((e) => (
        <div key={e.id} className={classes.editEntry}>
          <b>
            {formatPrice(e.before.money.grandTotalP)} to {formatPrice(e.after.money.grandTotalP)}
          </b>
          <div className={`${classes.muted} ${classes.small}`}>
            {e.staff?.name ?? 'Staff'} · {formatDateTime(e.createdAt)}
            {e.note ? ` · ${e.note}` : ''}
          </div>
          <ul className={classes.editFacts}>
            {describeEdit(e).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ))}
    </SectionCard>
  );
}
