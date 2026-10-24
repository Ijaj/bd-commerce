import {
  Anchor,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconCash, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BackLink, PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { num, t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import { ledgerLabel, ledgerNewestFirst } from './logic';
import { srRecentHundredQuery, srShopQuery } from './queries';
import { SaleItem } from './SaleItem';
import { NewBadge } from './ShopsPage';

export function ShopDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const shop = useQuery(srShopQuery(id));
  const sales = useQuery(srRecentHundredQuery);
  const [tab, setTab] = useState<'sales' | 'ledger'>('sales');
  return (
    <QueryBoundary query={shop}>
      {(s) => {
        const shopSales = sales.data?.items.filter((x) => x.shop.id === id) ?? [];
        const rows = ledgerNewestFirst(s.ledger);
        return (
          <Stack gap="md">
            <div>
              <BackLink to="/sr/shops">{t('backShops')}</BackLink>
              <PageTitle>
                {s.name}
                {s.isNew && <NewBadge />}
              </PageTitle>
            </div>
            <Paper>
              <Stack gap={4}>
                <Group justify="space-between" wrap="nowrap">
                  <Text c="dimmed">{t('owner')}</Text>
                  <Text>{s.ownerName ?? '-'}</Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text c="dimmed">{t('phone')}</Text>
                  <Anchor href={`tel:${s.phone}`}>{s.phone}</Anchor>
                </Group>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Text c="dimmed">{t('address')}</Text>
                  <Text ta="right">{[s.address, s.area].filter(Boolean).join(', ')}</Text>
                </Group>
              </Stack>
              <SimpleGrid cols={1} mt="md">
                <div>
                  <Text size="sm" c="dimmed">
                    {t('currentDueLabel')}
                  </Text>
                  <Text fz="xl" c={s.dueBalanceP > 0 ? 'red' : undefined} data-testid="shop-due">
                    {formatPrice(s.dueBalanceP)}
                  </Text>
                </div>
              </SimpleGrid>
            </Paper>
            <SimpleGrid cols={2}>
              <Button
                onClick={() => void navigate({ to: '/sr/new-sale', search: { shop: s.id } })}
                variant="light"
                leftSection={<IconPlus size={16} />}
              >
                {t('quickNewSale')}
              </Button>
              <Button
                onClick={() => void navigate({ to: '/sr/collections', search: { shop: s.id } })}
                variant="light"
                leftSection={<IconCash size={16} />}
              >
                {t('quickCollect')}
              </Button>
            </SimpleGrid>
            <SegmentedControl
              fullWidth
              value={tab}
              onChange={(v) => setTab(v as 'sales' | 'ledger')}
              data={[
                { value: 'sales', label: `${t('tabShopSales')} (${num(shopSales.length)})` },
                { value: 'ledger', label: t('tabLedger') },
              ]}
            />
            {tab === 'sales' ? (
              <Paper py={4}>
                {shopSales.length === 0 ? (
                  <Text c="dimmed" ta="center" py="md">
                    {t('noSales')}
                  </Text>
                ) : (
                  shopSales.map((x) => <SaleItem key={x.id} sale={x} />)
                )}
              </Paper>
            ) : rows.length === 0 ? (
              <Text c="dimmed" ta="center" py="md">
                {t('noLedger')}
              </Text>
            ) : (
              <Paper p="xs">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('ledgerDate')}</Table.Th>
                      <Table.Th>{t('ledgerEntry')}</Table.Th>
                      <Table.Th ta="right">{t('ledgerAmount')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((r) => (
                      <Table.Tr key={r.id} c={r.confirmed ? undefined : 'dimmed'}>
                        <Table.Td>{formatDate(r.at)}</Table.Td>
                        <Table.Td>
                          {ledgerLabel(r.type)}
                          <Text size="xs" c="dimmed">
                            {r.memoNo ?? r.note ?? ''}
                            {!r.confirmed && !r.rejected && ` ${t('awaitingConfirm')}`}
                          </Text>
                          {r.rejected && (
                            <Text size="xs" c="red">
                              {t('collectionRejectedReason', { reason: r.rejectReason ?? '-' })}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="right" td={r.rejected ? 'line-through' : undefined}>
                          {r.confirmed
                            ? `${r.amountP > 0 ? '+' : '-'}${formatPrice(Math.abs(r.amountP))}`
                            : `(${formatPrice(Math.abs(r.amountP))})`}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Text size="xs" c="dimmed" mt="xs">
                  {t('ledgerPendingHint')}
                </Text>
              </Paper>
            )}
          </Stack>
        );
      }}
    </QueryBoundary>
  );
}
