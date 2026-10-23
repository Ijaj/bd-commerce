import { Drawer, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { formatDateTime } from '~/lib/format';
import { optionText, reasonLabel, signed } from './logic';
import { type InventoryRow, type MovementRow, movementsQuery } from './queries';

function delta(n: number) {
  if (n === 0)
    return (
      <Text span c="dimmed">
        0
      </Text>
    );
  return (
    <Text span c={n > 0 ? 'green' : 'red'} fw={500}>
      {signed(n)}
    </Text>
  );
}

const columns: Column<MovementRow>[] = [
  { key: 'at', header: 'Date', render: (m) => formatDateTime(m.at) },
  { key: 'reason', header: 'Reason', render: (m) => reasonLabel(m.reason) },
  { key: 'qty', header: 'On hand', align: 'right', render: (m) => delta(m.qtyDelta) },
  { key: 'res', header: 'Reserved', align: 'right', render: (m) => delta(m.reservedDelta) },
  { key: 'staff', header: 'Staff', render: (m) => m.staff?.name ?? '-' },
  { key: 'note', header: 'Note', render: (m) => m.note ?? '' },
  {
    key: 'ref',
    header: 'Ref',
    render: (m) =>
      m.refType ? (
        <Text size="xs" c="dimmed">
          {m.refType}
          {m.refId ? ` ${m.refId.slice(0, 8)}` : ''}
        </Text>
      ) : (
        ''
      ),
  },
];

export function HistoryDrawer({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const variantId = row?.variantId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when another variant opens
  useEffect(() => setPage(1), [variantId]);

  const q = useQuery({ ...movementsQuery(variantId ?? '', page, pageSize), enabled: !!variantId });
  const options = row ? optionText(row.optionLabels) : '';

  return (
    <Drawer
      opened={!!row}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        row ? (
          <div>
            <Text fw={600}>Stock history</Text>
            <Text size="xs" c="dimmed">
              {row.productTitleEn}
              {options ? ` · ${options}` : ''} · SKU {row.sku}
            </Text>
          </div>
        ) : (
          'Stock history'
        )
      }
    >
      <DataTable
        columns={columns}
        rows={q.data?.items}
        rowKey={(m) => m.id}
        loading={q.isLoading}
        emptyMessage="No stock movements yet."
        page={page}
        pageSize={pageSize}
        total={q.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={[10, 20, 50]}
      />
    </Drawer>
  );
}
