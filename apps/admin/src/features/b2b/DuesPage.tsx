import { Alert, Card, Group, SegmentedControl, SimpleGrid, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatPrice } from '~/lib/format';
import { sortByDue, todayIso } from './logic';
import { type DueItem, duesQuery } from './queries';

const BUCKETS = [
  { key: 'd0_30', label: '0-30 days' },
  { key: 'd31_60', label: '31-60 days' },
  { key: 'd61_90', label: '61-90 days' },
  { key: 'd90plus', label: '90+ days' },
] as const;

export function DuesPage() {
  const [asOf, setAsOf] = useState(todayIso());
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');
  const q = useQuery(duesQuery(asOf));
  const totals = q.data?.totals;

  const columns: Column<DueItem>[] = [
    {
      key: 'shop',
      header: 'Shop',
      render: (r) => (
        <Link to="/b2b/shops/$id" params={{ id: r.shop.id }}>
          <Text size="sm" component="span">
            {r.shop.name}
          </Text>
        </Link>
      ),
    },
    { key: 'srs', header: 'SRs', render: (r) => r.srs.map((s) => s.name).join(', ') || '-' },
    ...BUCKETS.map(
      (b): Column<DueItem> => ({
        key: b.key,
        header: b.label,
        align: 'right',
        render: (r) => (r.buckets[b.key] ? formatPrice(r.buckets[b.key]) : '-'),
      }),
    ),
    {
      key: 'due',
      header: 'Total due',
      align: 'right',
      render: (r) => (
        <Text size="sm" fw={500} c="red">
          {formatPrice(r.dueP)}
        </Text>
      ),
    },
    {
      key: 'last',
      header: 'Last collection',
      render: (r) => (r.lastCollectionAt ? r.lastCollectionAt.slice(0, 10) : 'Never'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dues ageing"
        description="What shops owe, grouped by how old each sale's due is."
      />
      <Group mb="sm" align="flex-end">
        <DateInput
          label="As of"
          w={170}
          maxDate={todayIso()}
          valueFormat="DD MMM YYYY"
          value={asOf}
          onChange={(d) => d && setAsOf(d.slice(0, 10))}
        />
        <SegmentedControl
          aria-label="Sort by due"
          value={dir}
          onChange={(v) => setDir(v as 'asc' | 'desc')}
          data={[
            { value: 'desc', label: 'Highest due first' },
            { value: 'asc', label: 'Lowest due first' },
          ]}
        />
      </Group>

      {q.isError && <Alert color="red">{(q.error as Error).message}</Alert>}
      {totals && (
        <SimpleGrid cols={{ base: 2, sm: 5 }} mb="md" aria-label="Totals">
          {BUCKETS.map((b) => (
            <Card key={b.key} withBorder padding="sm">
              <Text size="xs" c="dimmed">
                {b.label}
              </Text>
              <Text size="lg">{formatPrice(totals[b.key])}</Text>
            </Card>
          ))}
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Total due
            </Text>
            <Text size="lg" fw={600} c="red">
              {formatPrice(totals.dueP)}
            </Text>
          </Card>
        </SimpleGrid>
      )}
      <DataTable
        columns={columns}
        rows={q.data ? sortByDue(q.data.items, dir) : undefined}
        rowKey={(r) => r.shop.id}
        loading={q.isLoading}
        emptyMessage="No shop owes anything on this date."
      />
    </div>
  );
}
