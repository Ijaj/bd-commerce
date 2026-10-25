import { Group, Paper, Table, Text } from '@mantine/core';
import { formatPrice } from '~/lib/format';
import type { OrderDetail } from './queries';

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <Group justify="space-between" gap="xl">
      <Text size="sm" c={dim ? 'dimmed' : undefined}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

/** Line items with fulfilment counters, then the money breakdown. */
export function OrderItemsCard({ order }: { order: OrderDetail }) {
  const m = order.money;
  return (
    <Paper withBorder p="md">
      <Text mb="xs">Items</Text>
      <Table.ScrollContainer minWidth={560}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Price</Table.Th>
              <Table.Th ta="right">Qty</Table.Th>
              <Table.Th>Fulfilment</Table.Th>
              <Table.Th ta="right">Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {order.items.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    {i.image && (
                      <img
                        src={i.image.url320}
                        alt={i.image.alt ?? ''}
                        width={40}
                        height={40}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <div>
                      <Text size="sm">{i.titleSnapshot}</Text>
                      <Text size="xs" c="dimmed">
                        {[i.optionsText, i.sku].filter(Boolean).join(' · ')}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{formatPrice(i.unitPriceP)}</Table.Td>
                <Table.Td ta="right">{i.qty}</Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {[
                      `${i.qtyShipped} shipped`,
                      i.qtyCancelled > 0 && `${i.qtyCancelled} cancelled`,
                      i.qtyReturned > 0 && `${i.qtyReturned} returned`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{formatPrice(i.lineTotalP)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <div style={{ maxWidth: 320, marginLeft: 'auto' }}>
        <Row label="Subtotal" value={formatPrice(m.subtotalP)} />
        {m.autoDiscountP > 0 && <Row label="Discount" value={`-${formatPrice(m.autoDiscountP)}`} />}
        {m.couponDiscountP > 0 && (
          <Row label="Coupon" value={`-${formatPrice(m.couponDiscountP)}`} />
        )}
        <Row label="Delivery" value={formatPrice(m.deliveryChargeP)} />
        {m.deliveryDiscountP > 0 && (
          <Row label="Delivery discount" value={`-${formatPrice(m.deliveryDiscountP)}`} />
        )}
        <Row label="Total" value={formatPrice(m.grandTotalP)} />
        <Row label="Paid" value={formatPrice(m.paidP)} dim />
        {m.refundedP > 0 && <Row label="Refunded" value={formatPrice(m.refundedP)} dim />}
        <Row label="Cash on delivery due" value={formatPrice(m.codDueP)} />
      </div>
    </Paper>
  );
}
