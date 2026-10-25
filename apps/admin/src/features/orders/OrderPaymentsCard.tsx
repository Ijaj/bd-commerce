import { Paper, Table, Text } from '@mantine/core';
import { formatDateTime, formatPrice } from '~/lib/format';
import type { OrderDetail } from './queries';

export function OrderPaymentsCard({ order }: { order: OrderDetail }) {
  return (
    <Paper withBorder p="md">
      <Text mb="xs">Payments</Text>
      {order.payments.length === 0 ? (
        <Text size="sm" c="dimmed">
          No payment records. {order.paymentMethod === 'cod' ? 'Cash on delivery.' : ''}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={400}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Method</Table.Th>
                <Table.Th>Purpose</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Paid at</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {order.payments.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.method}</Table.Td>
                  <Table.Td>{p.purpose}</Table.Td>
                  <Table.Td>{p.status}</Table.Td>
                  <Table.Td>{formatDateTime(p.paidAt)}</Table.Td>
                  <Table.Td ta="right">{formatPrice(p.amountP)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
