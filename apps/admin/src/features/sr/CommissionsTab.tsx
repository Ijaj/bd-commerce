import { Alert, Badge, Button, Collapse, Group, Stack, Text, Title } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { ConfirmAction } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import { srApi } from './api';
import { achievedPercent, currentMonth, dateToMonth, formatPercent, monthToDate } from './logic';
import {
  type Adjustment,
  adjustmentsQuery,
  type Commission,
  commissionsQuery,
  summaryQuery,
  useInvalidateSr,
} from './queries';

type SummaryRow = NonNullable<ReturnType<typeof useSummaryRows>>[number];
function useSummaryRows(month: string) {
  return useQuery(summaryQuery(month)).data?.items;
}

const STATUS_COLOR = { pending: 'yellow', approved: 'blue', paid: 'teal' } as const;

export function CommissionsTab() {
  const invalidate = useInvalidateSr();
  const [month, setMonth] = useState(currentMonth());
  const summary = useQuery(summaryQuery(month));
  const list = useQuery(commissionsQuery(month));
  const [adjPage, setAdjPage] = useState(1);
  const unapplied = useQuery(adjustmentsQuery('false', adjPage, 10));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const [computing, setComputing] = useState(false);
  const [acting, setActing] = useState<{ row: Commission; kind: 'approve' | 'paid' } | null>(null);

  const summaryCols: Column<SummaryRow>[] = [
    { key: 'name', header: 'SR', render: (r) => r.name },
    { key: 'target', header: 'Target', align: 'right', render: (r) => formatPrice(r.targetP) },
    { key: 'sold', header: 'Sold', align: 'right', render: (r) => formatPrice(r.soldP) },
    {
      key: 'ach',
      header: 'Achieved',
      align: 'right',
      render: (r) => {
        const pct = achievedPercent(r.soldP, r.targetP);
        return pct === null ? '-' : `${pct}%`;
      },
    },
    { key: 'coll', header: 'Collected', align: 'right', render: (r) => formatPrice(r.collectedP) },
    {
      key: 'pend',
      header: 'Awaiting confirmation',
      align: 'right',
      render: (r) => formatPrice(r.pendingCollectionP),
    },
    {
      key: 'comm',
      header: 'Commission',
      align: 'right',
      render: (r) => formatPrice(r.commissionP),
    },
    {
      key: 'due',
      header: 'Dues outstanding',
      align: 'right',
      render: (r) => formatPrice(r.dueOutstandingP),
    },
  ];

  const adjCols: Column<Adjustment>[] = [
    { key: 'sr', header: 'SR', render: (a) => a.sr.name },
    { key: 'memo', header: 'Sale', render: (a) => a.memoNo ?? '-' },
    { key: 'reason', header: 'Reason', render: (a) => a.reason },
    { key: 'amount', header: 'Amount', align: 'right', render: (a) => formatPrice(a.amountP) },
    { key: 'at', header: 'Created', render: (a) => formatDateTime(a.createdAt) },
  ];

  const columns: Column<Commission>[] = [
    { key: 'sr', header: 'SR', render: (c) => c.sr.name },
    { key: 'base', header: 'Base', align: 'right', render: (c) => formatPrice(c.baseP) },
    { key: 'rate', header: 'Rate', align: 'right', render: (c) => formatPercent(c.commissionBp) },
    {
      key: 'adj',
      header: 'Adjustments',
      render: (c) =>
        c.adjustments.length === 0 ? (
          '-'
        ) : (
          <div>
            <Button
              size="compact-xs"
              variant="subtle"
              color="orange"
              aria-expanded={open.has(c.id)}
              aria-label={`Adjustments for ${c.sr.name}`}
              onClick={() => toggle(c.id)}
            >
              {formatPrice(c.adjustmentP)} ({c.adjustments.length})
            </Button>
            <Collapse expanded={open.has(c.id)}>
              <Stack gap={2} mt={4}>
                {c.adjustments.map((a) => (
                  <Text key={a.id} size="xs" c="dimmed">
                    {formatPrice(a.amountP)}: {a.reason}
                  </Text>
                ))}
              </Stack>
            </Collapse>
          </div>
        ),
    },
    {
      key: 'amount',
      header: 'Commission (net)',
      align: 'right',
      render: (c) => formatPrice(c.amountP),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge size="sm" variant="light" color={STATUS_COLOR[c.status]}>
          {c.status[0]?.toUpperCase() + c.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) =>
        c.status === 'pending' ? (
          <Button size="compact-xs" onClick={() => setActing({ row: c, kind: 'approve' })}>
            Approve
          </Button>
        ) : c.status === 'approved' ? (
          <Button size="compact-xs" onClick={() => setActing({ row: c, kind: 'paid' })}>
            Mark paid
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Group mb="sm" align="flex-end" justify="space-between">
        <MonthPickerInput
          label="Month"
          w={180}
          value={monthToDate(month)}
          onChange={(d) => {
            const m = dateToMonth(d);
            if (m) setMonth(m);
          }}
        />
        <Button onClick={() => setComputing(true)}>Compute commissions</Button>
      </Group>

      <Title order={4} mb="xs">
        Performance
      </Title>
      {summary.isError && <Alert color="red">{(summary.error as Error).message}</Alert>}
      <DataTable
        columns={summaryCols}
        rows={summary.data?.items}
        rowKey={(r) => r.srStaffId}
        loading={summary.isLoading}
        emptyMessage="No sales reps yet."
      />

      <Title order={4} mt="lg" mb="xs">
        Commissions
      </Title>
      <Text size="xs" c="dimmed" mb="xs">
        Base = payment taken at sale on approved sales + confirmed collections in the month.
        Computing again updates pending rows only; approved and paid rows stay as they are.
      </Text>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        loading={list.isLoading}
        emptyMessage="Nothing computed for this month yet."
      />

      <Title order={4} mt="lg" mb="xs">
        Unapplied adjustments
      </Title>
      <Text size="xs" c="dimmed" mb="xs">
        Clawbacks from reversed sales whose commission was already approved or paid. They are
        deducted from that rep's next computed commission.
      </Text>
      {unapplied.isError && <Alert color="red">{(unapplied.error as Error).message}</Alert>}
      <DataTable
        columns={adjCols}
        rows={unapplied.data?.items}
        rowKey={(a) => a.id}
        loading={unapplied.isLoading}
        emptyMessage="No adjustments waiting."
        page={adjPage}
        pageSize={10}
        total={unapplied.data?.total}
        onPageChange={setAdjPage}
      />

      <ConfirmAction
        opened={computing}
        onClose={() => setComputing(false)}
        title="Compute commissions"
        confirmLabel="Compute"
        onConfirm={async () => {
          const r = await srApi.computeCommissions(month);
          notifyOk(
            r.skipped > 0
              ? `Computed. ${r.skipped} approved or paid row${r.skipped === 1 ? '' : 's'} left unchanged.`
              : 'Commissions computed',
          );
          invalidate();
        }}
      >
        Compute commissions for <b>{month}</b> from approved sales and confirmed collections?
      </ConfirmAction>

      <ConfirmAction
        opened={!!acting}
        onClose={() => setActing(null)}
        title={acting?.kind === 'paid' ? 'Mark commission paid' : 'Approve commission'}
        confirmLabel={acting?.kind === 'paid' ? 'Mark paid' : 'Approve'}
        onConfirm={async () => {
          if (!acting) return;
          if (acting.kind === 'paid') await srApi.payCommission(acting.row.id);
          else await srApi.approveCommission(acting.row.id);
          notifyOk(acting.kind === 'paid' ? 'Marked paid' : 'Commission approved');
          invalidate();
        }}
      >
        {acting?.kind === 'paid' ? 'Mark' : 'Approve'} {acting && formatPrice(acting.row.amountP)}{' '}
        for <b>{acting?.row.sr.name}</b>
        {acting?.kind === 'paid' ? ' as paid out?' : '? It then waits for payout.'}
      </ConfirmAction>
    </>
  );
}
