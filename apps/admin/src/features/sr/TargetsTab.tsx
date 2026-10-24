import { Alert, Button, Group, Text } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { srApi } from './api';
import { achievedPercent, changedTargets, currentMonth, dateToMonth, monthToDate } from './logic';
import { summaryQuery, targetsQuery, useInvalidateSr } from './queries';

type Row = { srStaffId: string; name: string; targetP: number | null };

export function TargetsTab() {
  const invalidate = useInvalidateSr();
  const [month, setMonth] = useState(currentMonth());
  const targets = useQuery(targetsQuery(month));
  const summary = useQuery(summaryQuery(month));
  const [edits, setEdits] = useState<Record<string, number | null>>({});

  const rows: Row[] = targets.data?.items ?? [];
  const changed = changedTargets(rows, edits);
  const sold = new Map((summary.data?.items ?? []).map((s) => [s.srStaffId, s.soldP]));

  const save = useMutation({
    mutationFn: () => srApi.setTargets(month, changed),
    onSuccess: () => {
      notifyOk('Targets saved');
      setEdits({});
      invalidate();
    },
    onError: (e) => notifyError(e, 'Could not save the targets'),
  });

  const columns: Column<Row>[] = [
    { key: 'name', header: 'SR', render: (r) => r.name },
    {
      key: 'target',
      header: 'Target',
      width: 200,
      render: (r) => (
        <MoneyInput
          aria-label={`Target for ${r.name}`}
          size="xs"
          placeholder="No target"
          value={r.srStaffId in edits ? edits[r.srStaffId] : r.targetP}
          onChange={(p) => setEdits((e) => ({ ...e, [r.srStaffId]: p }))}
        />
      ),
    },
    {
      key: 'sold',
      header: 'Sold this month',
      align: 'right',
      render: (r) => formatPrice(sold.get(r.srStaffId) ?? 0),
    },
    {
      key: 'ach',
      header: 'Achieved',
      align: 'right',
      render: (r) => {
        const pct = achievedPercent(sold.get(r.srStaffId) ?? 0, r.targetP);
        return pct === null ? '-' : `${pct}%`;
      },
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
            if (m) {
              setMonth(m);
              setEdits({});
            }
          }}
        />
        <Group>
          {changed.length > 0 && (
            <Text size="sm" c="dimmed">
              {changed.length} unsaved change{changed.length === 1 ? '' : 's'}
            </Text>
          )}
          <Button
            disabled={changed.length === 0}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save targets
          </Button>
        </Group>
      </Group>
      {targets.isError && <Alert color="red">{(targets.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={targets.data?.items}
        rowKey={(r) => r.srStaffId}
        loading={targets.isLoading}
        emptyMessage="No sales reps yet."
      />
    </>
  );
}
