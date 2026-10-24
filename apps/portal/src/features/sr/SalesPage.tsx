import { Button, Chip, Group, Paper, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
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
];

export function SalesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const sales = useQuery(srSalesQuery);
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
      <QueryBoundary query={sales}>
        {(all) => {
          const list = all.filter((s) => filter === 'all' || s.status === filter);
          return (
            <>
              <Group gap={6} wrap="nowrap" style={{ overflowX: 'auto' }}>
                {FILTERS.map((f) => (
                  <Chip
                    key={f.value}
                    checked={filter === f.value}
                    onChange={() => setFilter(f.value)}
                    variant="outline"
                    size="sm"
                  >
                    {f.label()}{' '}
                    {f.value === 'all'
                      ? all.length
                      : all.filter((s) => s.status === f.value).length}
                  </Chip>
                ))}
              </Group>
              <Paper py={4}>
                {list.length === 0 ? (
                  <Text c="dimmed" ta="center" py="md">
                    {t('noSales')}
                  </Text>
                ) : (
                  list.map((s) => <SaleItem key={s.id} sale={s} />)
                )}
              </Paper>
            </>
          );
        }}
      </QueryBoundary>
    </Stack>
  );
}
