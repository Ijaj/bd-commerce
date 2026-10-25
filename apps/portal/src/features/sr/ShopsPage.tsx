import { Icon } from '@bdc/ui';
import { Badge, Button, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { LoadMore } from '~/components/LoadMore';
import { BackLink, PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { t } from '~/i18n';
import { formatPrice } from '~/lib/format';
import { AddShopForm } from './AddShopForm';
import { srShopsQuery } from './queries';

export function NewBadge() {
  return (
    <Badge color="blue" variant="light" ml={6}>
      {t('newBadge')}
    </Badge>
  );
}

export function ShopsPage() {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 250);
  const shops = useInfiniteQuery(srShopsQuery(debounced));
  return (
    <>
      <PageTitle
        right={
          <Button
            component={Link}
            to="/sr/shops/new"
            size="compact-sm"
            leftSection={<Icon name="plus" size={14} />}
          >
            {t('addShop')}
          </Button>
        }
      >
        {t('myShops')}
      </PageTitle>
      <TextInput
        type="search"
        mb="sm"
        placeholder={t('searchShopsShort')}
        leftSection={<Icon name="search" size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <QueryBoundary query={shops}>
        {(data) => {
          const list = data.pages.flatMap((p) => p.items);
          const total = data.pages[0]?.total ?? 0;
          return (
            <>
              <div className="sr-muted sr-mb">{t('shopsCount', { n: total })}</div>
              {list.length === 0 ? (
                <div className="sr-empty">{t('noShops')}</div>
              ) : (
                list.map((s) => (
                  <Link key={s.id} to="/sr/shops/$id" params={{ id: s.id }} className="sr-item">
                    <div className="t">
                      <span>
                        {s.name}
                        {s.isNew && <NewBadge />}
                        {s.status === 'blocked' && (
                          <Badge color="red" variant="light" ml={6}>
                            {t('blocked')}
                          </Badge>
                        )}
                      </span>
                      <span className={s.dueBalanceP > 0 ? 'sr-due' : 'sr-ok'}>
                        {s.dueBalanceP > 0 ? formatPrice(s.dueBalanceP) : t('clear')}
                      </span>
                    </div>
                    <div className="s">
                      <span>{[s.ownerName, s.area].filter(Boolean).join(' · ')}</span>
                      <span>{s.phone}</span>
                    </div>
                  </Link>
                ))
              )}
              <LoadMore query={shops} />
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}

export function AddShopPage() {
  const navigate = useNavigate();
  return (
    <>
      <BackLink to="/sr/shops">{t('backShops')}</BackLink>
      <PageTitle>{t('addShopTitle')}</PageTitle>
      <div className="sr-note">{t('addShopNote')}</div>
      <AddShopForm
        onCreated={(shop) => {
          notifications.show({ message: t('shopSaved'), color: 'green' });
          void navigate({ to: '/sr/shops/$id', params: { id: shop.id } });
        }}
      />
    </>
  );
}
