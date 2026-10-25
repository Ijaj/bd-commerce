import { Banner, KeyValue, SectionCard } from '@bdc/ui';
import { Button, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { ConfirmAction, ReasonModal } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
import classes from '~/features/orders/Orders.module.css';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { ApproveModal } from './ApproveModal';
import { returnsApi } from './api';
import { RefundStatusBadge, ReturnStatusBadge, ReturnTimeline } from './components';
import { InspectModal } from './InspectModal';
import { LIVE_REFUND, REASON_LABEL, returnActions } from './logic';
import { PickupModal } from './PickupModal';
import { type ReturnDetail, returnQuery, useInvalidateReturns } from './queries';
import { RefundDetailModal } from './RefundDetailModal';
import { RefundFormModal } from './RefundFormModal';

type Modalname = 'approve' | 'reject' | 'pickup' | 'receive' | 'inspect' | 'close' | 'refund';

type Line = ReturnDetail['items'][number];

const lineColumns: Column<Line>[] = [
  {
    key: 'item',
    header: 'Item',
    render: (i) => (
      <div>
        <b>{i.titleSnapshot}</b>
        <span className={classes.sub}>
          {i.sku}
          {i.optionsText ? ` · ${i.optionsText}` : ''}
        </span>
      </div>
    ),
  },
  { key: 'qty', header: 'Qty', align: 'right', render: (i) => i.qty },
  {
    key: 'reason',
    header: 'Reason',
    render: (i) => (
      <div>
        {REASON_LABEL[i.reason]}
        {i.note && <span className={classes.sub}>{i.note}</span>}
      </div>
    ),
  },
  {
    key: 'cond',
    header: 'Inspection',
    render: (i) =>
      i.condition
        ? `${i.condition === 'resellable' ? 'Resellable' : 'Damaged'}${i.restock ? ', restocked' : ''}`
        : '-',
  },
  {
    key: 'value',
    header: 'Refund value',
    align: 'right',
    render: (i) => formatPrice(i.refundValueP),
  },
];

export function ReturnDetailPage({ id }: { id: string }) {
  const canManage = useCan('returns.manage');
  const canRefund = useCan('refunds.manage');
  const invalidate = useInvalidateReturns();
  const q = useQuery(returnQuery(id));
  const [modal, setModal] = useState<Modalname | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const r = q.data;

  if (q.isError) return <Banner tone="danger">Could not load this return.</Banner>;
  if (!r)
    return (
      <div className="a-card">
        <div className="a-empty" role="status" aria-label="Loading">
          <Loader size="sm" />
        </div>
      </div>
    );

  const can = returnActions(r.status);
  const close = () => setModal(null);
  const hasLiveRefund = r.refunds.some((x) => LIVE_REFUND.includes(x.status));

  const summary: Array<[ReactNode, ReactNode]> = [
    [
      'Customer',
      `${r.order.customerName ?? '-'} ${r.order.customerPhone ? `· ${r.order.customerPhone}` : ''}`,
    ],
    [
      'Fault',
      `${r.fault === 'ours' ? 'Ours' : r.fault === 'customer' ? 'Customer' : 'Not decided'}${
        r.fault === 'customer' && r.returnShippingP > 0
          ? ` · return shipping ${formatPrice(r.returnShippingP)} deducted`
          : ''
      }`,
    ],
    [
      'Order payment',
      `Paid ${formatPrice(r.order.paidP)} · refunded ${formatPrice(r.order.refundedP)}`,
    ],
  ];
  if (r.note) {
    const noteNode: ReactNode = <span className={classes.pre}>{r.note}</span>;
    summary.push(['Note', noteNode]);
  }
  if (r.mediaIds.length > 0)
    summary.push(['Photos', `${r.mediaIds.length} attached by the customer`]);
  const refundColumns: Column<ReturnDetail['refunds'][number]>[] = [
    { key: 'at', header: 'Created', render: (x) => formatDateTime(x.createdAt) },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (x) => <b>{formatPrice(x.amountP)}</b>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (x) => (x.method === 'wallet' ? 'Wallet' : 'Original'),
    },
    { key: 'status', header: 'Status', render: (x) => <RefundStatusBadge status={x.status} /> },
    {
      key: 'act',
      header: '',
      render: (x) => (
        <Button size="compact-sm" variant="subtle" onClick={() => setRefundId(x.id)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className={classes.stack}>
      <PageHeader
        title={r.returnNo}
        crumbs={[
          'Sales',
          <Link key="returns" to="/returns">
            Returns
          </Link>,
          r.returnNo,
        ]}
        description={
          <>
            Order{' '}
            <Link to="/orders/$id" params={{ id: r.order.id }} className={classes.orderNo}>
              {r.order.orderNo}
            </Link>{' '}
            · requested {formatDateTime(r.requestedAt)}
          </>
        }
        actions={<ReturnStatusBadge status={r.status} />}
      />

      <ReturnTimeline status={r.status} />

      {r.status === 'rejected' && r.rejectReason && (
        <Banner tone="danger">Rejected: {r.rejectReason}</Banner>
      )}

      {canManage && (
        <div className={classes.actions}>
          {can.approve && <Button onClick={() => setModal('approve')}>Approve</Button>}
          {can.pickupBooked && (
            <Button variant="default" onClick={() => setModal('pickup')}>
              Pickup booked
            </Button>
          )}
          {can.receive && <Button onClick={() => setModal('receive')}>Mark received</Button>}
          {can.inspect && <Button onClick={() => setModal('inspect')}>Inspect</Button>}
          {can.close && <Button onClick={() => setModal('close')}>Close return</Button>}
          {can.reject && (
            <Button color="red" onClick={() => setModal('reject')}>
              Reject
            </Button>
          )}
        </div>
      )}

      <SectionCard title="Summary">
        <KeyValue items={summary} />
      </SectionCard>

      <SectionCard title="Items" flush>
        <DataTable columns={lineColumns} rows={r.items} rowKey={(i) => i.id} />
      </SectionCard>

      <SectionCard
        title="Refunds"
        flush={r.refunds.length > 0}
        actions={
          canRefund && can.refund && !hasLiveRefund ? (
            <Button size="compact-sm" onClick={() => setModal('refund')}>
              Create refund
            </Button>
          ) : undefined
        }
      >
        {r.refunds.length === 0 ? (
          <p className={`${classes.muted} ${classes.small}`}>
            No refund yet.{' '}
            {can.refund ? '' : 'A refund can be created once the return is inspected.'}
          </p>
        ) : (
          <DataTable columns={refundColumns} rows={r.refunds} rowKey={(x) => x.id} />
        )}
      </SectionCard>

      <ApproveModal ret={r} opened={modal === 'approve'} onClose={close} />
      <PickupModal ret={r} opened={modal === 'pickup'} onClose={close} />
      {modal === 'inspect' && <InspectModal ret={r} opened onClose={close} />}
      {modal === 'refund' && (
        <RefundFormModal target={{ kind: 'return', ret: r }} opened onClose={close} />
      )}
      <ReasonModal
        opened={modal === 'reject'}
        onClose={close}
        title={`Reject ${r.returnNo}`}
        confirmLabel="Reject return"
        onSubmit={async (reason) => {
          await returnsApi.reject(r.id, reason);
          invalidate();
          notifyOk('Return rejected');
        }}
      >
        The customer sees this reason.
      </ReasonModal>
      <ConfirmAction
        opened={modal === 'receive'}
        onClose={close}
        title="Mark received"
        confirmLabel="Mark received"
        onConfirm={async () => {
          await returnsApi.receive(r.id);
          invalidate();
          notifyOk('Return marked as received');
        }}
      >
        The parcel has arrived back at the warehouse.
      </ConfirmAction>
      <ConfirmAction
        opened={modal === 'close'}
        onClose={close}
        title="Close return"
        confirmLabel="Close return"
        onConfirm={async () => {
          await returnsApi.close(r.id);
          invalidate();
          notifyOk('Return closed');
        }}
      >
        Closing finishes the return. Refunds can still be created afterwards.
      </ConfirmAction>
      <RefundDetailModal id={refundId} onClose={() => setRefundId(null)} />
    </div>
  );
}
