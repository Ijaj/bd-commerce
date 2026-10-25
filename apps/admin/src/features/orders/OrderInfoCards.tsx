import { KeyValue, SectionCard } from '@bdc/ui';
import { Badge } from '@mantine/core';
import type { ReactNode } from 'react';
import { formatDateTime } from '~/lib/format';
import { CallBadge } from './badges';
import { actorText, riskReasonText } from './logic';
import classes from './Orders.module.css';
import type { OrderDetail } from './queries';

/** Customer, ship-to, call/risk and notes (right column of the mockup's order page). */
export function OrderInfoCards({ order }: { order: OrderDetail }) {
  const s = order.shipTo;
  const riskNode: ReactNode =
    order.risk.reasons.length === 0 ? (
      'None flagged'
    ) : (
      <span className={classes.reasons}>
        {order.risk.reasons.map((r) => (
          <Badge key={r} size="sm" color="red">
            {riskReasonText(r)}
          </Badge>
        ))}
      </span>
    );
  const callRows: Array<[ReactNode, ReactNode]> = [
    [
      'Call',
      <>
        <span className={classes.row}>
          <CallBadge status={order.call.status} />
          {order.call.status === 'not_needed' && 'Not needed'}
        </span>
        {order.call.at && (
          <div className={`${classes.muted} ${classes.small}`}>
            {order.call.staffName ?? 'Staff'} · {formatDateTime(order.call.at)}
          </div>
        )}
        {order.call.note && <div className={classes.note}>{order.call.note}</div>}
      </>,
    ],
    ['Risk', riskNode],
  ];
  if (order.customerNote) callRows.push(['Customer note', order.customerNote]);
  if (order.heldReason) callRows.push(['Hold reason', order.heldReason]);
  if (order.cancelReason) callRows.push(['Cancel reason', order.cancelReason]);
  return (
    <>
      <SectionCard title="Customer">
        <KeyValue
          items={[
            [
              'Name',
              <>
                {order.customer.name}
                {order.customer.isGuest && ' (guest)'}
              </>,
            ],
            ['Phone', order.customer.phone],
            ['Language', order.lang === 'bn' ? 'Bangla' : 'English'],
          ]}
        />
      </SectionCard>
      <SectionCard title="Ship to">
        <KeyValue
          items={[
            [
              'Recipient',
              <>
                {s.name} · {s.phone}
              </>,
            ],
            [
              'Address',
              <>
                {s.line}
                {s.landmark && ` (${s.landmark})`}
                <br />
                {s.placeText}
              </>,
            ],
            ['Delivery zone', order.zone.nameEn],
          ]}
        />
      </SectionCard>
      <SectionCard
        title="Call and risk"
        actions={
          order.risk.reasons.length > 0 ? (
            <span className="a-badge danger">{order.risk.reasons.length}</span>
          ) : undefined
        }
      >
        <KeyValue items={callRows} />
      </SectionCard>
    </>
  );
}

export function OrderHistoryCard({ order }: { order: OrderDetail }) {
  return (
    <SectionCard title="Status history">
      <ol className="a-timeline">
        {order.history.map((h, i) => (
          <li key={h.id} className={i === order.history.length - 1 ? 'current' : 'done'}>
            <b>
              {h.fromStatus ? `${label(h.fromStatus)} to ${label(h.toStatus)}` : label(h.toStatus)}
            </b>
            <div className={`${classes.muted} ${classes.small}`}>
              {actorText(h)} · {formatDateTime(h.at)}
              {h.note ? ` · ${h.note}` : ''}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function label(s: string) {
  const t = s.replace(/_/g, ' ');
  return t[0]?.toUpperCase() + t.slice(1);
}
