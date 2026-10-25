import { StatTile, Toolbar } from '@bdc/ui';
import { Alert, SegmentedControl } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatPrice } from '~/lib/format';
import classes from './b2b.module.css';
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
          <b>{r.shop.name}</b>
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
      render: (r) => <span className={classes.due}>{formatPrice(r.dueP)}</span>,
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
        crumbs={['People & partners', 'B2B dues']}
        description="What shops owe, grouped by how old each sale's due is."
      />
      <Toolbar>
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
      </Toolbar>

      {q.isError && <Alert color="red">{(q.error as Error).message}</Alert>}
      {totals && (
        <section className={classes.kpis} aria-label="Totals">
          {BUCKETS.map((b) => (
            <StatTile key={b.key} label={b.label} value={formatPrice(totals[b.key])} />
          ))}
          <StatTile
            label="Total due"
            value={formatPrice(totals.dueP)}
            delta="chase oldest first"
            deltaDir="down"
          />
        </section>
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
