import { SectionCard, TableWrap } from '@bdc/ui';
import { Table } from '@mantine/core';
import { formatDateTime, formatPrice } from '~/lib/format';
import classes from './Orders.module.css';
import type { OrderDetail } from './queries';

export function OrderPaymentsCard({ order }: { order: OrderDetail }) {
  return (
    <SectionCard title="Payments" flush={order.payments.length > 0}>
      {order.payments.length === 0 ? (
        <p className={`${classes.muted} ${classes.small}`}>
          No payment records. {order.paymentMethod === 'cod' ? 'Cash on delivery.' : ''}
        </p>
      ) : (
        <TableWrap>
          <Table miw={400}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Method</Table.Th>
                <Table.Th>Purpose</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Paid at</Table.Th>
                <Table.Th className="num">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {order.payments.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.method}</Table.Td>
                  <Table.Td>{p.purpose}</Table.Td>
                  <Table.Td>{p.status}</Table.Td>
                  <Table.Td>{formatDateTime(p.paidAt)}</Table.Td>
                  <Table.Td className="num">{formatPrice(p.amountP)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </TableWrap>
      )}
    </SectionCard>
  );
}
