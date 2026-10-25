import { Banner, EmptyState, SectionCard } from '@bdc/ui';
import { Button, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import type { CallOutcome } from './api';
import { CallBadge, RiskBadge } from './badges';
import { CallOutcomeModal } from './CallOutcomeModal';
import { riskReasonText } from './logic';
import classes from './Orders.module.css';
import { callQueueQuery, type OrderListItem } from './queries';

const PAGE_SIZE = 25;

function QueueRow({
  order,
  pending,
  onOutcome,
}: {
  order: OrderListItem;
  pending: boolean;
  onOutcome?: (o: CallOutcome) => void;
}) {
  return (
    <div className={classes.qrow}>
      <div className={classes.qmain}>
        <div className={classes.qtitle}>
          <Link to="/orders/$id" params={{ id: order.id }} className={classes.orderNo}>
            {order.orderNo}
          </Link>
          <span className={`${classes.muted} ${classes.small}`}>
            {formatDateTime(order.placedAt)}
          </span>
          <RiskBadge score={order.riskScore} reasons={order.riskReasons} />
          {!pending && <CallBadge status={order.callStatus} />}
        </div>
        <b>
          {order.customer.name}
          {order.customer.isGuest ? ' (guest)' : ''} · {order.customer.phone}
        </b>
        <span className={classes.sub}>
          {order.shipPlaceText} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} ·{' '}
          {formatPrice(order.grandTotalP)}
          {order.codDueP > 0 ? ` (COD ${formatPrice(order.codDueP)})` : ''}
        </span>
        {order.riskReasons.length > 0 && (
          <span className={classes.qreason}>
            {order.riskReasons.map(riskReasonText).join(', ')}
          </span>
        )}
        {!pending && order.callNote && <span className={classes.note}>{order.callNote}</span>}
      </div>
      {pending && onOutcome && (
        <div className={classes.qactions}>
          <Button size="compact-sm" onClick={() => onOutcome('confirmed')}>
            Confirmed
          </Button>
          <Button size="compact-sm" variant="default" onClick={() => onOutcome('unreachable')}>
            Unreachable
          </Button>
          <Button size="compact-sm" color="red" onClick={() => onOutcome('cancelled')}>
            Cancelled
          </Button>
        </div>
      )}
    </div>
  );
}

export function CallQueuePage() {
  const canCall = useCan('orders.call');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [page, setPage] = useState(1);
  const list = useQuery({ ...callQueueQuery(tab, page, PAGE_SIZE), enabled: canCall });
  const [active, setActive] = useState<{ order: OrderListItem; outcome: CallOutcome } | null>(null);
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!canCall)
    return <Banner tone="info">You do not have permission to use the call queue.</Banner>;

  return (
    <div>
      <PageHeader
        title="Call queue"
        crumbs={['Sales', 'Call queue']}
        description="Orders flagged as risky. Call the customer, then record the outcome. Oldest first."
      />
      <div className={classes.tabsWrap}>
        <div className="a-tabs" role="tablist" aria-label="Queue">
          {(['pending', 'done'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="a-tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t === 'pending' ? 'Pending' : 'Done'}
            </button>
          ))}
        </div>
      </div>
      {list.isError && (
        <div className={classes.errorCard}>
          <Banner tone="danger">{(list.error as Error).message}</Banner>
        </div>
      )}
      <SectionCard flush>
        {list.isLoading && (
          <div className="a-empty" role="status" aria-label="Loading">
            <Loader size="sm" />
          </div>
        )}
        {list.data?.items.map((o) => (
          <QueueRow
            key={o.id}
            order={o}
            pending={tab === 'pending'}
            onOutcome={(outcome) => setActive({ order: o, outcome })}
          />
        ))}
        {list.data && list.data.items.length === 0 && (
          <EmptyState
            icon="phone"
            title={tab === 'pending' ? 'No calls waiting.' : 'No completed calls yet.'}
          >
            {tab === 'pending' ? 'Risky orders show up here for a confirmation call.' : undefined}
          </EmptyState>
        )}
      </SectionCard>
      {total > PAGE_SIZE && (
        <div className="a-pager">
          <span>
            Page {page} of {pages}, {total} orders
          </span>
          <div className="a-row">
            <Button
              size="compact-sm"
              variant="default"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="compact-sm"
              variant="default"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {active && (
        <CallOutcomeModal
          key={`${active.order.id}-${active.outcome}`}
          opened
          onClose={() => setActive(null)}
          orderId={active.order.id}
          orderNo={active.order.orderNo}
          initial={active.outcome}
        />
      )}
    </div>
  );
}
