import { Badge } from '@mantine/core';
import classes from '~/features/orders/Orders.module.css';
import { formatDateTime } from '~/lib/format';
import { type Shipment, type ShipmentStatus, STATUS_COLOR, STATUS_LABEL } from './logic';

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge size="sm" variant="light" color={STATUS_COLOR[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Under the badge: who took a failed parcel back, when, and why. */
export function ReceivedBackInfo({ shipment }: { shipment: Shipment }) {
  if (!shipment.receivedBackAt) return null;
  return (
    <span className={classes.sub}>
      Received back{shipment.receivedBackBy?.name ? ` by ${shipment.receivedBackBy.name}` : ''} ·{' '}
      {formatDateTime(shipment.receivedBackAt)}
      {shipment.receivedBackNote ? ` · ${shipment.receivedBackNote}` : ''}
    </span>
  );
}
