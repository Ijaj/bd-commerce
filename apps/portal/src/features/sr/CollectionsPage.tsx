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
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LoadMore } from '~/components/LoadMore';
import { PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import { takaToPaisa } from '~/lib/money';
import { type CollectionMethod, srApi } from './api';
import { srCollectionsQuery, srKeys, srShopQuery, srShopsQuery } from './queries';

const METHODS: { value: CollectionMethod; label: () => string }[] = [
  { value: 'cash', label: () => t('methodCash') },
  { value: 'bkash', label: () => t('methodBkash') },
  { value: 'nagad', label: () => t('methodNagad') },
  { value: 'bank', label: () => t('methodBank') },
];

export function CollectionsPage({ initialShopId }: { initialShopId?: string }) {
  const collections = useInfiniteQuery(srCollectionsQuery);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 250);
  const shops = useInfiniteQuery(srShopsQuery(debounced));

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

  // The selected shop may not be on the first search page, so it is fetched on its own.
  const selected = useQuery({
    ...srShopQuery(form.values.shopId ?? ''),
    enabled: Boolean(form.values.shopId),
  });

  const listed = shops.data?.pages.flatMap((p) => p.items) ?? [];
  const options = [...listed];
  if (selected.data && !options.some((s) => s.id === selected.data?.id))
    options.unshift(selected.data);

  function dueOf(id: string | null) {
    return options.find((s) => s.id === id)?.dueBalanceP ?? 0;
  }

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
            searchValue={search}
            onSearchChange={setSearch}
            // The API filters by the typed text; Mantine must not filter again.
            filter={({ options: o }) => o}
            nothingFoundMessage={t('noShops')}
            data={options.map((s) => ({
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

      <Title order={2}>{t('recentCollections')}</Title>
      <QueryBoundary query={collections}>
        {(data) => {
          const list = data.pages.flatMap((p) => p.items);
          return list.length === 0 ? (
            <Text c="dimmed">{t('noCollections')}</Text>
          ) : (
            <>
              <Paper py={4}>
                {list.map((c) => (
                  <div key={c.id} className="portal-item">
                    <Group justify="space-between" wrap="nowrap">
                      <Text truncate td={c.rejected ? 'line-through' : undefined}>
                        {c.shopName}
                      </Text>
                      <Text>{formatPrice(Math.abs(c.amountP))}</Text>
                    </Group>
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" c="dimmed">
                        {formatDate(c.at)} · {METHODS.find((m) => m.value === c.method)?.label()}
                      </Text>
                      <Badge
                        color={c.rejected ? 'red' : c.confirmed ? 'green' : 'yellow'}
                        variant="light"
                      >
                        {c.rejected
                          ? t('collectionRejected')
                          : c.confirmed
                            ? t('confirmed')
                            : t('pendingConfirm')}
                      </Badge>
                    </Group>
                    {c.rejected && (
                      <Text size="sm" c="red">
                        {t('collectionRejectedReason', { reason: c.rejectReason ?? '-' })}
                      </Text>
                    )}
                  </div>
                ))}
              </Paper>
              <LoadMore query={collections} />
            </>
          );
        }}
      </QueryBoundary>
    </Stack>
  );
}
