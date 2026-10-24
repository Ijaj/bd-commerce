import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import { takaToPaisa } from '~/lib/money';
import { type CollectionMethod, srApi } from './api';
import { srCollectionsQuery, srKeys, srShopsQuery } from './queries';

const METHODS: { value: CollectionMethod; label: () => string }[] = [
  { value: 'cash', label: () => t('methodCash') },
  { value: 'bkash', label: () => t('methodBkash') },
  { value: 'nagad', label: () => t('methodNagad') },
  { value: 'bank', label: () => t('methodBank') },
];

export function CollectionsPage({ initialShopId }: { initialShopId?: string }) {
  const shops = useQuery(srShopsQuery);
  const collections = useQuery(srCollectionsQuery);
  const qc = useQueryClient();

  const withDue = (shops.data ?? []).filter((s) => s.dueBalanceP > 0);
  const dueOf = (id: string | null) => withDue.find((s) => s.id === id)?.dueBalanceP ?? 0;

  const form = useForm<{
    shopId: string | null;
    amount: number | string;
    method: CollectionMethod;
    note: string;
  }>({
    initialValues: { shopId: initialShopId ?? null, amount: '', method: 'cash', note: '' },
    validate: {
      shopId: (v) => (v ? null : t('errShopRequired')),
      amount: (v, values) => {
        const p = takaToPaisa(v);
        if (!p || p < 100) return t('errAmountMin');
        const due = dueOf(values.shopId);
        return p > due ? t('errAmountMax', { amount: formatPrice(due) }) : null;
      },
    },
  });

  const submit = useMutation({
    mutationFn: (v: typeof form.values) =>
      srApi.createCollection({
        b2bShopId: v.shopId as string,
        amountP: takaToPaisa(v.amount) as number,
        method: v.method,
        note: v.note.trim() || undefined,
      }),
    onSuccess: async () => {
      notifications.show({ message: t('collectionSaved'), color: 'green' });
      form.reset();
      await qc.invalidateQueries({ queryKey: srKeys.all });
    },
  });

  return (
    <Stack gap="md">
      <PageTitle>{t('recordCollection')}</PageTitle>
      <Alert variant="light">{t('collectionNote')}</Alert>
      <QueryBoundary query={shops}>
        {() => (
          <form onSubmit={form.onSubmit((v) => submit.mutate(v))} noValidate>
            <Stack gap="sm">
              {submit.error && (
                <Alert color="red" variant="light">
                  {submit.error.message}
                </Alert>
              )}
              <Select
                label={t('chooseShop')}
                searchable
                data={withDue.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${t('due')} ${formatPrice(s.dueBalanceP)})`,
                }))}
                {...form.getInputProps('shopId')}
              />
              <NumberInput
                label={t('amountCollected')}
                min={0}
                decimalScale={2}
                allowNegative={false}
                {...form.getInputProps('amount')}
              />
              <Select
                label={t('method')}
                allowDeselect={false}
                data={METHODS.map((m) => ({ value: m.value, label: m.label() }))}
                {...form.getInputProps('method')}
              />
              <TextInput
                label={t('noteRef')}
                placeholder={t('noteRefPlaceholder')}
                {...form.getInputProps('note')}
              />
              <Button type="submit" loading={submit.isPending}>
                {t('submitCollection')}
              </Button>
            </Stack>
          </form>
        )}
      </QueryBoundary>

      <Title order={2}>{t('recentCollections')}</Title>
      <QueryBoundary query={collections}>
        {(list) =>
          list.length === 0 ? (
            <Text c="dimmed">{t('noCollections')}</Text>
          ) : (
            <Paper py={4}>
              {list.slice(0, 20).map((c) => (
                <div key={c.id} className="portal-item">
                  <Group justify="space-between" wrap="nowrap">
                    <Text truncate>{c.shopName}</Text>
                    <Text>{formatPrice(Math.abs(c.amountP))}</Text>
                  </Group>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      {formatDate(c.at)} · {METHODS.find((m) => m.value === c.method)?.label()}
                    </Text>
                    <Badge color={c.confirmed ? 'green' : 'yellow'} variant="light">
                      {c.confirmed ? t('confirmed') : t('pendingConfirm')}
                    </Badge>
                  </Group>
                </div>
              ))}
            </Paper>
          )
        }
      </QueryBoundary>
    </Stack>
  );
}
