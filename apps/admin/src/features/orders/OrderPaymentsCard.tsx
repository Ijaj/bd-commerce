import { SectionCard, TableWrap } from '@bdc/ui';
import { Table } from '@mantine/core';
import { formatDateTime, formatPrice } from '~/lib/format';
import classes from './Orders.module.css';
import type { OrderDetail } from './queries';

const METHOD_LABEL: Record<string, string> = {
  cod: 'Cash on delivery',
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  card: 'Card',
  wallet: 'Wallet',
  bank: 'Bank transfer',
};
const PURPOSE_LABEL: Record<string, string> = {
  full: 'Full payment',
  advance: 'Advance',
  balance: 'Balance',
  cod: 'Cash on delivery',
  preorder: 'Pre-order deposit',
};

/** `partially_paid` -> "Partially paid" for values without an explicit label. */
function humanize(v: string, labels: Record<string, string> = {}): string {
  const known = labels[v];
  if (known) return known;
  const text = v.replace(/[_-]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
                  <Table.Td>{humanize(p.method, METHOD_LABEL)}</Table.Td>
                  <Table.Td>{humanize(p.purpose, PURPOSE_LABEL)}</Table.Td>
                  <Table.Td>{humanize(p.status)}</Table.Td>
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
