import { Alert, Badge, Group, Select, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import type { ShopFilters } from './api';
import { type Shop, shopsQuery } from './queries';

const ANY = 'any';

export function ShopsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const [status, setStatus] = useState(ANY);
  const [flag, setFlag] = useState(ANY);
  const [due, setDue] = useState(ANY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filters: ShopFilters = {
    page,
    pageSize,
    ...(debounced ? { q: debounced } : {}),
    ...(status !== ANY ? { status: status as 'active' | 'blocked' } : {}),
    ...(flag !== ANY ? { isNew: flag as 'true' | 'false' } : {}),
    ...(due !== ANY ? { hasDue: due as 'true' | 'false' } : {}),
  };
  const list = useQuery(shopsQuery(filters));
  const reset = (set: (v: string) => void) => (v: string | null) => {
    set(v ?? ANY);
    setPage(1);
  };

  const columns: Column<Shop>[] = [
    {
      key: 'shop',
      header: 'Shop',
      render: (s) => (
        <div>
          <Text size="sm" fw={500}>
            {s.name}
          </Text>
          {s.ownerName && (
            <Text size="xs" c="dimmed">
              {s.ownerName}
            </Text>
          )}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (s) => s.phone },
    { key: 'area', header: 'Area', render: (s) => s.area ?? '-' },
    { key: 'sr', header: 'Added by', render: (s) => s.createdBy.name },
    {
      key: 'flags',
      header: 'Flags',
      render: (s) => (
        <Group gap={4}>
          {s.isNew && (
            <Badge size="sm" variant="light" color="yellow">
              New
            </Badge>
          )}
          {s.status === 'blocked' && (
            <Badge size="sm" variant="light" color="red">
              Blocked
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: 'due',
      header: 'Current due',
      align: 'right',
      render: (s) => (
        <Text size="sm" c={s.dueBalanceP > 0 ? 'red' : undefined}>
          {formatPrice(s.dueBalanceP)}
        </Text>
      ),
    },
    { key: 'created', header: 'Added', render: (s) => formatDateTime(s.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Buyer shops"
        description="Shops that buy through sales reps, and what they owe."
      />
      <Group mb="sm" align="flex-end">
        <TextInput
          label="Search"
          placeholder="Name, owner or phone"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
          w={240}
        />
        <Select
          label="Status"
          w={140}
          allowDeselect={false}
          value={status}
          onChange={reset(setStatus)}
          data={[
            { value: ANY, label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
        <Select
          label="New shops"
          w={150}
          allowDeselect={false}
          value={flag}
          onChange={reset(setFlag)}
          data={[
            { value: ANY, label: 'All' },
            { value: 'true', label: 'Needs review' },
            { value: 'false', label: 'Reviewed' },
          ]}
        />
        <Select
          label="Dues"
          w={150}
          allowDeselect={false}
          value={due}
          onChange={reset(setDue)}
          data={[
            { value: ANY, label: 'All' },
            { value: 'true', label: 'Has due' },
            { value: 'false', label: 'No due' },
          ]}
        />
      </Group>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(s) => s.id}
        loading={list.isLoading}
        emptyMessage="No shops match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(s) => navigate({ to: '/b2b/shops/$id', params: { id: s.id } })}
      />
    </div>
  );
}
