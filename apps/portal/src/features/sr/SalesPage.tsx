import { Icon } from '@bdc/ui';
import { Button } from '@mantine/core';
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
    <>
      <PageTitle
        right={
          <Button
            component={Link}
            to="/sr/new-sale"
            size="compact-sm"
            leftSection={<Icon name="plus" size={14} />}
          >
            {t('tabNewSale')}
          </Button>
        }
      >
        {t('mySales')}
      </PageTitle>
      <div className="sr-chips">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label()}
          </button>
        ))}
      </div>
      <QueryBoundary query={sales}>
        {(data) => {
          const list = data.pages.flatMap((p) => p.items);
          return (
            <>
              {list.length === 0 ? (
                <div className="sr-empty">{t('noSales')}</div>
              ) : (
                list.map((s) => <SaleItem key={s.id} sale={s} />)
              )}
              <LoadMore query={sales} />
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}
