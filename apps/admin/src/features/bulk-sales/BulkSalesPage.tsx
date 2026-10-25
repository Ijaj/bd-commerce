import { Badge, Button, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { describeRule } from './logic';
import { type BulkBatch, bulkListQuery } from './queries';

export function BulkSalesPage() {
  const navigate = useNavigate();
  const canManage = useCan('bulk_sales.manage');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const list = useQuery(bulkListQuery(page, pageSize));

  const columns: Column<BulkBatch>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (b) => (
        <Link to="/promotions/bulk-sales/$id" params={{ id: b.id }}>
          {b.name}
        </Link>
      ),
    },
    { key: 'rule', header: 'Discount', render: (b) => describeRule(b.mode, b.value, formatPrice) },
    { key: 'at', header: 'Applied', render: (b) => formatDateTime(b.createdAt) },
    {
      key: 'by',
      header: 'By',
      render: (b) => <Text size="sm">{b.createdByName ?? '-'}</Text>,
    },
    { key: 'items', header: 'Variants', align: 'right', render: (b) => b.itemCount },
    {
      key: 'status',
      header: 'Status',
      render: (b) =>
        b.undoneAt ? (
          <Badge size="sm" variant="light" color="gray">
            Undone
          </Badge>
        ) : (
          <Badge size="sm" variant="light" color="green">
            Applied
          </Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bulk sales"
        description="Sale prices set on many variants at once, each batch can be undone."
        actions={
          canManage && (
            <Button
              component={Link}
              to="/promotions/bulk-sales/new"
              leftSection={<IconPlus size={16} />}
            >
              New bulk sale
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(b) => b.id}
        loading={list.isLoading}
        emptyMessage="No bulk sales yet."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        onRowClick={(b) => navigate({ to: '/promotions/bulk-sales/$id', params: { id: b.id } })}
      />
    </>
  );
}
