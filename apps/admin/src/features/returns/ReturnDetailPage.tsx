import { Alert, Button, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { ConfirmAction, ReasonModal } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
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
        <Text size="sm">{i.titleSnapshot}</Text>
        <Text size="xs" c="dimmed">
          {i.sku}
          {i.optionsText ? ` · ${i.optionsText}` : ''}
        </Text>
      </div>
    ),
  },
  { key: 'qty', header: 'Qty', align: 'right', render: (i) => i.qty },
  {
    key: 'reason',
    header: 'Reason',
    render: (i) => (
      <div>
        <Text size="sm">{REASON_LABEL[i.reason]}</Text>
        {i.note && (
          <Text size="xs" c="dimmed">
            {i.note}
          </Text>
        )}
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

  if (q.isError) return <Alert color="red">Could not load this return.</Alert>;
  if (!r) return <Loader size="sm" />;

  const can = returnActions(r.status);
  const close = () => setModal(null);
  const hasLiveRefund = r.refunds.some((x) => LIVE_REFUND.includes(x.status));

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{r.returnNo}</Title>
          <Text size="sm" c="dimmed">
            Order{' '}
            <Link to="/orders/$id" params={{ id: r.order.id }}>
              {r.order.orderNo}
            </Link>{' '}
            · requested {formatDateTime(r.requestedAt)}
          </Text>
        </div>
        <ReturnStatusBadge status={r.status} />
      </Group>

      <ReturnTimeline status={r.status} />

      {r.status === 'rejected' && r.rejectReason && (
        <Alert color="red" variant="light">
          Rejected: {r.rejectReason}
        </Alert>
      )}

      {canManage && (
        <Group>
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
            <Button color="red" variant="light" onClick={() => setModal('reject')}>
              Reject
            </Button>
          )}
        </Group>
      )}

      <Table>
        <Table.Tbody>
          <Table.Tr>
            <Table.Th w={160}>Customer</Table.Th>
            <Table.Td>
              {r.order.customerName ?? '-'}{' '}
              {r.order.customerPhone ? `· ${r.order.customerPhone}` : ''}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Fault</Table.Th>
            <Table.Td>
              {r.fault === 'ours' ? 'Ours' : r.fault === 'customer' ? 'Customer' : 'Not decided'}
              {r.fault === 'customer' && r.returnShippingP > 0
                ? ` · return shipping ${formatPrice(r.returnShippingP)} deducted`
                : ''}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Order payment</Table.Th>
            <Table.Td>
              Paid {formatPrice(r.order.paidP)} · refunded {formatPrice(r.order.refundedP)}
            </Table.Td>
          </Table.Tr>
          {r.note && (
            <Table.Tr>
              <Table.Th>Note</Table.Th>
              <Table.Td>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {r.note}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {r.mediaIds.length > 0 && (
            <Table.Tr>
              <Table.Th>Photos</Table.Th>
              <Table.Td>{r.mediaIds.length} attached by the customer</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <DataTable columns={lineColumns} rows={r.items} rowKey={(i) => i.id} />

      <Group justify="space-between">
        <Title order={4}>Refunds</Title>
        {canRefund && can.refund && !hasLiveRefund && (
          <Button onClick={() => setModal('refund')}>Create refund</Button>
        )}
      </Group>
      {r.refunds.length === 0 ? (
        <Text size="sm" c="dimmed">
          No refund yet. {can.refund ? '' : 'A refund can be created once the return is inspected.'}
        </Text>
      ) : (
        <Table>
          <Table.Tbody>
            {r.refunds.map((x) => (
              <Table.Tr key={x.id}>
                <Table.Td>{formatDateTime(x.createdAt)}</Table.Td>
                <Table.Td>{formatPrice(x.amountP)}</Table.Td>
                <Table.Td>{x.method === 'wallet' ? 'Wallet' : 'Original'}</Table.Td>
                <Table.Td>
                  <RefundStatusBadge status={x.status} />
                </Table.Td>
                <Table.Td>
                  <Button size="compact-sm" variant="subtle" onClick={() => setRefundId(x.id)}>
                    Details
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

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
    </Stack>
  );
}
