import { Alert, Button, Group, Loader, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { CreateShipmentModal } from './CreateShipmentModal';
import { freeQuantities } from './logic';
import { orderShipmentsQuery, shipOrderQuery } from './queries';
import { ShipmentActions } from './ShipmentActions';
import { StatusBadge } from './StatusBadge';

/** Shipments of one order, embedded in the order detail page. */
export function OrderShipmentsSection({ orderId }: { orderId: string }) {
  const canManage = useCan('shipments.manage');
  const [creating, setCreating] = useState(false);
  const shipments = useQuery(orderShipmentsQuery(orderId));
  const order = useQuery({ ...shipOrderQuery(orderId), enabled: canManage });

  const items = shipments.data?.items ?? [];
  const free = order.data ? freeQuantities(order.data.items, items) : null;
  const lines = order.data
    ? order.data.items.map((i) => ({
        id: i.id,
        title: i.titleSnapshot,
        sku: i.sku,
        optionsText: i.optionsText,
        free: free?.get(i.id) ?? 0,
      }))
    : [];
  const hasFree = lines.some((l) => l.free > 0);
  const shippable = order.data && ['processing', 'partially_shipped'].includes(order.data.status);

  return (
    <section>
      <Group justify="space-between" mb="xs">
        <Title order={4}>Shipments</Title>
        {canManage && order.data && (
          <Button
            size="compact-md"
            disabled={!hasFree || !shippable}
            onClick={() => setCreating(true)}
          >
            Create shipment
          </Button>
        )}
      </Group>
      {canManage && order.data && !shippable && hasFree && (
        <Text size="xs" c="dimmed" mb="xs">
          Shipments can be created while the order is processing or partially shipped.
        </Text>
      )}
      {shipments.isLoading && <Loader size="sm" />}
      {shipments.isError && <Alert color="red">{shipments.error.message}</Alert>}
      {shipments.data && items.length === 0 && (
        <Text size="sm" c="dimmed">
          No shipments yet.
        </Text>
      )}
      {items.length > 0 && (
        <Table.ScrollContainer minWidth={560}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Shipment</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th ta="right">COD</Table.Th>
                <Table.Th>Courier</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.shipmentNo}</Table.Td>
                  <Table.Td>
                    {s.items.map((i) => (
                      <Text size="sm" key={i.id}>
                        {i.qty} x {i.titleSnapshot}
                      </Text>
                    ))}
                  </Table.Td>
                  <Table.Td ta="right">{formatPrice(s.codAmountP)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{s.courier?.name ?? '-'}</Text>
                    {s.trackingUrl ? (
                      <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer">
                        <Text size="xs" component="span">
                          {s.consignmentId ?? 'Track'}
                        </Text>
                      </a>
                    ) : (
                      s.consignmentId && (
                        <Text size="xs" c="dimmed">
                          {s.consignmentId}
                        </Text>
                      )
                    )}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={s.status} />
                  </Table.Td>
                  <Table.Td ta="right">
                    <ShipmentActions shipment={s} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {order.data && (
        <CreateShipmentModal
          key={items.length}
          opened={creating}
          onClose={() => setCreating(false)}
          orderId={orderId}
          lines={lines}
          codDueP={order.data.money.codDueP}
        />
      )}
    </section>
  );
}
