import { Badge } from '@mantine/core';
import { type ShipmentStatus, STATUS_COLOR, STATUS_LABEL } from './logic';

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge size="sm" variant="light" color={STATUS_COLOR[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
