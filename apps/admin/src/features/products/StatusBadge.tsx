import { Badge } from '@mantine/core';
import type { ProductStatus } from './types';

const COLORS: Record<ProductStatus, string> = {
  draft: 'gray',
  active: 'green',
  archived: 'orange',
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge color={COLORS[status]} variant="light" tt="capitalize">
      {status}
    </Badge>
  );
}
