import { Banner, EmptyState, SectionCard, TableWrap } from '@bdc/ui';
import { Button, Loader, Table } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import classes from '~/features/orders/Orders.module.css';
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
    <SectionCard
      title="Shipments"
      flush={items.length > 0}
      actions={
        canManage && order.data ? (
          <Button
            size="compact-sm"
            disabled={!hasFree || !shippable}
            onClick={() => setCreating(true)}
          >
            Create shipment
          </Button>
        ) : undefined
      }
    >
      {canManage && order.data && !shippable && hasFree && (
        <p className={`${classes.muted} ${classes.small}`}>
          Shipments can be created while the order is processing or partially shipped.
        </p>
      )}
      {shipments.isLoading && <Loader size="sm" />}
      {shipments.isError && <Banner tone="danger">{shipments.error.message}</Banner>}
      {shipments.data && items.length === 0 && (
        <EmptyState icon="truck" title="No shipments yet.">
          Create a shipment to book a courier.
        </EmptyState>
      )}
      {items.length > 0 && (
        <TableWrap>
          <Table miw={560}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Shipment</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th className="num">COD</Table.Th>
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
                      <div key={i.id}>
                        {i.qty} x {i.titleSnapshot}
                      </div>
                    ))}
                  </Table.Td>
                  <Table.Td className="num">{formatPrice(s.codAmountP)}</Table.Td>
                  <Table.Td>
                    {s.courier?.name ?? '-'}
                    {s.trackingUrl ? (
                      <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer">
                        <span className={classes.sub}>{s.consignmentId ?? 'Track'}</span>
                      </a>
                    ) : (
                      s.consignmentId && <span className={classes.sub}>{s.consignmentId}</span>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={s.status} />
                  </Table.Td>
                  <Table.Td className="act">
                    <ShipmentActions shipment={s} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </TableWrap>
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
    </SectionCard>
  );
}
