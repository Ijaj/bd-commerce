import { Badge } from '@mantine/core';
import type { SaleStatus } from '~/features/sr/api';
import { STATUS_COLOR, statusLabel } from '~/features/sr/logic';

export function StatusBadge({ status }: { status: SaleStatus }) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" style={{ flexShrink: 0 }}>
      {statusLabel(status)}
    </Badge>
  );
}
