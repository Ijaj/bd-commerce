import { Button, Chip, Group, Paper, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { LoadMore } from '~/components/LoadMore';
import { PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { t } from '~/i18n';
import type { SaleStatus } from './api';
import { srSalesQuery } from './queries';
import { SaleItem } from './SaleItem';

type Filter = 'all' | SaleStatus;

const FILTERS: { value: Filter; label: () => string }[] = [
  { value: 'all', label: () => t('filterAll') },
  { value: 'submitted', label: () => t('filterPending') },
  { value: 'approved', label: () => t('filterApproved') },
  { value: 'delivered', label: () => t('filterDelivered') },
  { value: 'rejected', label: () => t('filterRejected') },
  { value: 'reversed', label: () => t('filterReversed') },
];

export function SalesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const sales = useInfiniteQuery(srSalesQuery(filter === 'all' ? undefined : filter));
  return (
    <Stack gap="sm">
      <PageTitle
        right={
          <Button component={Link} to="/sr/new-sale" size="xs" leftSection={<IconPlus size={14} />}>
            {t('tabNewSale')}
          </Button>
        }
      >
        {t('mySales')}
      </PageTitle>
      <Group gap={6} wrap="nowrap" style={{ overflowX: 'auto' }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            checked={filter === f.value}
            onChange={() => setFilter(f.value)}
            variant="outline"
            size="sm"
          >
            {f.label()}
          </Chip>
        ))}
      </Group>
      <QueryBoundary query={sales}>
        {(data) => {
          const list = data.pages.flatMap((p) => p.items);
          return (
            <>
              <Paper py={4}>
                {list.length === 0 ? (
                  <Text c="dimmed" ta="center" py="md">
                    {t('noSales')}
                  </Text>
                ) : (
                  list.map((s) => <SaleItem key={s.id} sale={s} />)
                )}
              </Paper>
              <LoadMore query={sales} />
            </>
          );
        }}
      </QueryBoundary>
    </Stack>
  );
}
