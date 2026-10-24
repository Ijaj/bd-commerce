import {
  Anchor,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconBuildingStore, IconCash, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { QueryBoundary } from '~/components/QueryBoundary';
import { num, t } from '~/i18n';
import { daysLeftInMonth, formatMonth, formatPrice } from '~/lib/format';
import { srMeQuery, srPendingQuery, srRecentSalesQuery } from './queries';
import { SaleItem } from './SaleItem';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/** Shows the install card only when the browser offers it (Chrome/Android). */
function InstallCard() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEv(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  if (!ev) return null;
  return (
    <Paper mb="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text>{t('installApp')}</Text>
          <Text size="sm" c="dimmed">
            {t('installSub')}
          </Text>
        </div>
        <Button
          size="sm"
          onClick={() => {
            void ev.prompt();
            setEv(null);
          }}
        >
          {t('install')}
        </Button>
      </Group>
    </Paper>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function HomePage() {
  const me = useQuery(srMeQuery);
  const sales = useQuery(srRecentSalesQuery);
  const pendingCount = useQuery(srPendingQuery).data ?? 0;
  return (
    <QueryBoundary query={me}>
      {(d) => {
        const m = d.month;
        const soldPct = pct(m.soldP, m.targetP);
        return (
          <Stack gap="md">
            <InstallCard />
            <div>
              <Title order={1}>{t('hello', { name: d.staff.name.split(' ')[0] ?? '' })}</Title>
              <Text size="sm" c="dimmed">
                {formatMonth()}
              </Text>
            </div>

            <Paper>
              <Title order={2}>{t('monthTarget')}</Title>
              <Group align="baseline" gap="xs" mt={4}>
                <Text fz={28} fw={700} data-testid="sold">
                  {formatPrice(m.soldP)}
                </Text>
                <Text c="dimmed" size="sm">
                  {m.targetP > 0
                    ? t('ofTarget', { target: formatPrice(m.targetP) })
                    : t('noTarget')}
                </Text>
              </Group>
              <Progress value={Math.min(100, soldPct)} my="xs" />
              {m.targetP > 0 && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {t('percentSold', { pct: soldPct })}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t('toGo', { amount: formatPrice(Math.max(0, m.targetP - m.soldP)) })} ·{' '}
                    {t('daysLeft', { n: daysLeftInMonth() })}
                  </Text>
                </Group>
              )}
              <Group
                justify="space-between"
                mt="md"
                pt="sm"
                style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
              >
                <div>
                  <Text size="sm" c="dimmed">
                    {t('collectedMonth')}
                  </Text>
                  <Text fz="lg" data-testid="collected">
                    {formatPrice(m.collectedP)}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="sm" c="dimmed">
                    {t('collectionRate')}
                  </Text>
                  <Text fz="lg">{num(pct(m.collectedP, m.soldP))}%</Text>
                </div>
              </Group>
            </Paper>

            <Paper>
              <Title order={2}>{t('commission')}</Title>
              <Text fz={26} c="teal" data-testid="commission">
                {formatPrice(m.commissionP)}
              </Text>
              <Text size="sm" c="dimmed">
                {t('commissionNote', { rate: d.profile.commissionBp / 100 })}
              </Text>
            </Paper>

            <SimpleGrid cols={2}>
              <Paper component={Link} to="/sr/shops" td="none" c="inherit">
                <Text size="sm" c="dimmed">
                  {t('dueOutstanding')}
                </Text>
                <Text fz="xl" c={m.dueOutstandingP > 0 ? 'red' : undefined} data-testid="due">
                  {formatPrice(m.dueOutstandingP)}
                </Text>
              </Paper>
              <Paper component={Link} to="/sr/sales" td="none" c="inherit">
                <Text size="sm" c="dimmed">
                  {t('filterPending')}
                </Text>
                <Text fz="xl">{num(pendingCount)}</Text>
              </Paper>
            </SimpleGrid>

            <SimpleGrid cols={3}>
              <Button
                component={Link}
                to="/sr/new-sale"
                variant="light"
                leftSection={<IconPlus size={16} />}
              >
                {t('quickNewSale')}
              </Button>
              <Button
                component={Link}
                to="/sr/collections"
                variant="light"
                leftSection={<IconCash size={16} />}
              >
                {t('quickCollect')}
              </Button>
              <Button
                component={Link}
                to="/sr/shops/new"
                variant="light"
                leftSection={<IconBuildingStore size={16} />}
              >
                {t('quickAddShop')}
              </Button>
            </SimpleGrid>

            <Paper>
              <Group justify="space-between">
                <Title order={2}>{t('recentSales')}</Title>
                <Anchor component={Link} to="/sr/sales" size="sm">
                  {t('seeAll')}
                </Anchor>
              </Group>
              <QueryBoundary query={sales}>
                {(list) =>
                  list.items.length === 0 ? (
                    <Text c="dimmed" py="sm">
                      {t('noSales')}
                    </Text>
                  ) : (
                    list.items.map((s) => <SaleItem key={s.id} sale={s} />)
                  )
                }
              </QueryBoundary>
            </Paper>
          </Stack>
        );
      }}
    </QueryBoundary>
  );
}
