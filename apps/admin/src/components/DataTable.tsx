import { TableWrap } from '@bdc/ui';
import { Loader, Pagination, Select, Table } from '@mantine/core';
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
 * Mockup table (`.a-table-wrap` + `.a-table` + `.a-pager`) with loading/empty states and optional server-side pagination
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
    <TableWrap>
      <Table miw={500}>
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
              className={onRowClick ? 'click' : undefined}
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

      {loading && (
        <div className="a-empty" role="status" aria-label="Loading">
          <Loader size="sm" />
        </div>
      )}
      {!loading && rows && rows.length === 0 && (
        <div className="a-empty">
          <p>{emptyMessage}</p>
        </div>
      )}

      {paged && (
        <div className="a-pager">
          <span>{total === 0 ? '0 results' : `${from}-${to} of ${total}`}</span>
          <div className="a-row">
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
          </div>
        </div>
      )}
    </TableWrap>
  );
}
