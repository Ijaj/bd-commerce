import { Banner, EmptyState, SectionCard, TableWrap } from '@bdc/ui';
import { Button, Loader, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import classes from '~/features/orders/Orders.module.css';
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

  if (q.isError) return <Banner tone="danger">Could not load returns for this order.</Banner>;
  if (!order) return <Loader size="sm" />;
  const empty = order.returns.length === 0 && order.refunds.length === 0;

  const delivered = order.status === 'delivered' || order.status === 'completed';
  const refundable = order.money.paidP - order.money.refundedP > 0;
  const close = () => setModal(null);

  return (
    <SectionCard
      title="Returns and refunds"
      flush={!empty}
      actions={
        <span className={classes.row}>
          {canReturn && delivered && (
            <Button size="compact-sm" variant="default" onClick={() => setModal('return')}>
              Create return
            </Button>
          )}
          {canRefund && refundable && (
            <Button size="compact-sm" variant="default" onClick={() => setModal('refund')}>
              Refund order
            </Button>
          )}
        </span>
      }
    >
      {empty ? (
        <EmptyState icon="returns" title="No returns or refunds on this order.">
          {!delivered && 'Returns open once the order is delivered.'}
        </EmptyState>
      ) : (
        <TableWrap>
          <Table miw={420}>
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
        </TableWrap>
      )}

      {modal === 'return' && <CreateReturnModal order={order} opened onClose={close} />}
      {modal === 'refund' && (
        <RefundFormModal target={{ kind: 'order', order }} opened onClose={close} />
      )}
      <RefundDetailModal id={refundId} onClose={() => setRefundId(null)} />
    </SectionCard>
  );
}
