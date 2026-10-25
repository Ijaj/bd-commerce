import { Alert, Button, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { CreateReturnModal } from './CreateReturnModal';
import { RefundStatusBadge, ReturnStatusBadge } from './components';
import { sectionOrderQuery } from './queries';
import { RefundDetailModal } from './RefundDetailModal';
import { RefundFormModal } from './RefundFormModal';

/** Compact returns + refunds list for the order detail page. */
export function OrderReturnsSection({ orderId }: { orderId: string }) {
  const canReturn = useCan('returns.manage');
  const canRefund = useCan('refunds.manage');
  const q = useQuery(sectionOrderQuery(orderId));
  const [modal, setModal] = useState<'return' | 'refund' | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const order = q.data;

  if (q.isError) return <Alert color="red">Could not load returns for this order.</Alert>;
  if (!order) return <Loader size="sm" />;

  const delivered = order.status === 'delivered' || order.status === 'completed';
  const refundable = order.money.paidP - order.money.refundedP > 0;
  const close = () => setModal(null);

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Title order={4}>Returns and refunds</Title>
        <Group gap="xs">
          {canReturn && delivered && (
            <Button size="compact-md" variant="default" onClick={() => setModal('return')}>
              Create return
            </Button>
          )}
          {canRefund && refundable && (
            <Button size="compact-md" variant="default" onClick={() => setModal('refund')}>
              Refund order
            </Button>
          )}
        </Group>
      </Group>

      {order.returns.length === 0 && order.refunds.length === 0 ? (
        <Text size="sm" c="dimmed">
          No returns or refunds on this order.
          {!delivered && ' Returns open once the order is delivered.'}
        </Text>
      ) : (
        <Table>
          <Table.Tbody>
            {order.returns.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>Return</Table.Td>
                <Table.Td>
                  {canReturn ? (
                    <Link to="/returns/$id" params={{ id: r.id }}>
                      {r.returnNo}
                    </Link>
                  ) : (
                    r.returnNo
                  )}
                </Table.Td>
                <Table.Td />
                <Table.Td>
                  <ReturnStatusBadge status={r.status as never} />
                </Table.Td>
              </Table.Tr>
            ))}
            {order.refunds.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>Refund</Table.Td>
                <Table.Td>
                  {canRefund ? (
                    <Button size="compact-sm" variant="subtle" onClick={() => setRefundId(r.id)}>
                      Details
                    </Button>
                  ) : null}
                </Table.Td>
                <Table.Td>
                  {formatPrice(r.amountP)} · {r.method === 'wallet' ? 'wallet' : 'original'}
                </Table.Td>
                <Table.Td>
                  <RefundStatusBadge status={r.status as never} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {modal === 'return' && <CreateReturnModal order={order} opened onClose={close} />}
      {modal === 'refund' && (
        <RefundFormModal target={{ kind: 'order', order }} opened onClose={close} />
      )}
      <RefundDetailModal id={refundId} onClose={() => setRefundId(null)} />
    </Stack>
  );
}
