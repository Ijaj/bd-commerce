import { Alert, Badge, Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BackLink, PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { t } from '~/i18n';
import { formatPrice } from '~/lib/format';
import { AddShopForm } from './AddShopForm';
import { shopMatches } from './logic';
import { srShopsQuery } from './queries';

export function NewBadge() {
  return (
    <Badge color="indigo" variant="light" ml={6}>
      {t('newBadge')}
    </Badge>
  );
}

export function ShopsPage() {
  const shops = useQuery(srShopsQuery);
  const [q, setQ] = useState('');
  return (
    <Stack gap="sm">
      <PageTitle
        right={
          <Button
            component={Link}
            to="/sr/shops/new"
            size="xs"
            leftSection={<IconPlus size={14} />}
          >
            {t('addShop')}
          </Button>
        }
      >
        {t('myShops')}
      </PageTitle>
      <TextInput
        type="search"
        placeholder={t('searchShopsShort')}
        leftSection={<IconSearch size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <QueryBoundary query={shops}>
        {(all) => {
          const list = all
            .filter((s) => shopMatches(s, q))
            .sort((a, b) => b.dueBalanceP - a.dueBalanceP);
          const totalDue = all.reduce((a, s) => a + s.dueBalanceP, 0);
          return (
            <>
              <Text size="sm" c="dimmed">
                {t('shopsSummary', { n: list.length, amount: formatPrice(totalDue) })}
              </Text>
              <Paper py={4}>
                {list.length === 0 ? (
                  <Text c="dimmed" ta="center" py="md">
                    {t('noShops')}
                  </Text>
                ) : (
                  list.map((s) => (
                    <Link
                      key={s.id}
                      to="/sr/shops/$id"
                      params={{ id: s.id }}
                      className="portal-item"
                    >
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text truncate>
                          {s.name}
                          {s.isNew && <NewBadge />}
                        </Text>
                        <Text
                          c={s.dueBalanceP > 0 ? 'red' : 'teal'}
                          size="sm"
                          style={{ flexShrink: 0 }}
                        >
                          {s.dueBalanceP > 0 ? formatPrice(s.dueBalanceP) : t('clear')}
                        </Text>
                      </Group>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text size="sm" c="dimmed" truncate>
                          {[s.ownerName, s.area].filter(Boolean).join(' · ')}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {s.phone}
                        </Text>
                      </Group>
                    </Link>
                  ))
                )}
              </Paper>
            </>
          );
        }}
      </QueryBoundary>
    </Stack>
  );
}

export function AddShopPage() {
  const navigate = useNavigate();
  return (
    <Stack gap="sm">
      <BackLink to="/sr/shops">{t('backShops')}</BackLink>
      <PageTitle>{t('addShopTitle')}</PageTitle>
      <Alert variant="light">{t('addShopNote')}</Alert>
      <AddShopForm
        onCreated={(shop) => {
          notifications.show({ message: t('shopSaved'), color: 'green' });
          void navigate({ to: '/sr/shops/$id', params: { id: shop.id } });
        }}
      />
    </Stack>
  );
}
