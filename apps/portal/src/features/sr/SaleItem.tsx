import { Group, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { StatusBadge } from '~/components/StatusBadge';
import { t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import type { SrSaleSummary } from './api';

/** One row in a sale list (home + my sales). */
export function SaleItem({ sale }: { sale: SrSaleSummary }) {
  return (
    <Link to="/sr/sales/$id" params={{ id: sale.id }} className="portal-item">
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text truncate>{sale.shop.name}</Text>
        <StatusBadge status={sale.status} />
      </Group>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" c="dimmed">
          {formatDate(sale.submittedAt)} · {sale.memoNo}
        </Text>
        <Text size="sm">
          {formatPrice(sale.totalP)}
          {sale.dueP > 0 && sale.status !== 'rejected' && sale.status !== 'cancelled' && (
            <Text span size="sm" c="red">
              {' '}
              · {t('due')} {formatPrice(sale.dueP)}
            </Text>
          )}
        </Text>
      </Group>
    </Link>
  );
}
