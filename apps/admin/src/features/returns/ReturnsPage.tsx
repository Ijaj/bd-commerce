import { Group, Select, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime } from '~/lib/format';
import { ReturnStatusBadge } from './components';
import { RETURN_STATUS_LABEL } from './logic';
import { type ReturnRow, type ReturnStatus, returnsQuery } from './queries';

const STATUS_OPTIONS = (Object.keys(RETURN_STATUS_LABEL) as ReturnStatus[]).map((value) => ({
  value,
  label: RETURN_STATUS_LABEL[value],
}));

export function ReturnsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ReturnStatus | null>(null);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const list = useQuery(
    returnsQuery({ status: status ?? undefined, q: q || undefined, page, pageSize }),
  );

  const columns: Column<ReturnRow>[] = [
    {
      key: 'no',
      header: 'Return',
      render: (r) => (
        <Link to="/returns/$id" params={{ id: r.id }}>
          {r.returnNo}
        </Link>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (r) => (
        <Link to="/orders/$id" params={{ id: r.orderId }}>
          {r.orderNo}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (r) => (
        <div>
          <Text size="sm">{r.customerName ?? '-'}</Text>
          <Text size="xs" c="dimmed">
            {r.customerPhone ?? ''}
          </Text>
        </div>
      ),
    },
    { key: 'items', header: 'Lines', align: 'right', render: (r) => r.itemCount },
    { key: 'status', header: 'Status', render: (r) => <ReturnStatusBadge status={r.status} /> },
    {
      key: 'fault',
      header: 'Fault',
      render: (r) => (r.fault === 'ours' ? 'Ours' : r.fault === 'customer' ? 'Customer' : '-'),
    },
    { key: 'at', header: 'Requested', render: (r) => formatDateTime(r.requestedAt) },
  ];

  return (
    <>
      <PageHeader title="Returns" description="Return requests from customers and staff." />
      <Group mb="md" align="flex-end">
        <TextInput
          label="Search"
          placeholder="Return no, order no, phone or name"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={280}
        />
        <Select
          label="Status"
          placeholder="All"
          clearable
          data={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v as ReturnStatus | null);
            setPage(1);
          }}
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage="No returns match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        onRowClick={(r) => navigate({ to: '/returns/$id', params: { id: r.id } })}
      />
    </>
  );
}
