import { Center, Group, Loader, Pagination, Select, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: ReactNode;
  /** Server-side pagination: 1-based page, total = row count across all pages. */
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  onRowClick?: (row: T) => void;
}

/**
 * Plain Mantine table with loading/empty states and optional server-side pagination
 * (shown when `total`, `page`, `pageSize` and `onPageChange` are given).
 *   <DataTable columns={cols} rows={data?.items} rowKey={(r) => r.id} loading={isLoading}
 *     page={page} pageSize={20} total={data?.total} onPageChange={setPage} />
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage = 'Nothing here yet.',
  page = 1,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  onRowClick,
}: DataTableProps<T>) {
  const paged = total !== undefined && pageSize !== undefined && onPageChange !== undefined;
  const pages = paged ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const from = paged && total > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = paged ? Math.min(total, page * pageSize) : 0;

  return (
    <div>
      <Table.ScrollContainer minWidth={500}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              {columns.map((c) => (
                <Table.Th key={c.key} w={c.width} ta={c.align}>
                  {c.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows?.map((row) => (
              <Table.Tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((c) => (
                  <Table.Td key={c.key} ta={c.align}>
                    {c.render(row)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {loading && (
        <Center py="lg" aria-label="Loading">
          <Loader size="sm" />
        </Center>
      )}
      {!loading && rows && rows.length === 0 && (
        <Center py="lg">
          <Text c="dimmed" size="sm">
            {emptyMessage}
          </Text>
        </Center>
      )}

      {paged && (
        <Group justify="space-between" mt="sm">
          <Text size="xs" c="dimmed">
            {total === 0 ? '0 results' : `${from}-${to} of ${total}`}
          </Text>
          <Group gap="sm">
            {onPageSizeChange && (
              <Select
                w={80}
                data={pageSizeOptions.map(String)}
                value={String(pageSize)}
                onChange={(v) => v && onPageSizeChange(Number(v))}
                allowDeselect={false}
                aria-label="Rows per page"
              />
            )}
            <Pagination size="sm" total={pages} value={page} onChange={onPageChange} />
          </Group>
        </Group>
      )}
    </div>
  );
}
