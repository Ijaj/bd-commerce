import { StatusBadge, Toolbar } from '@bdc/ui';
import { Alert, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import type { CustomerFilters } from './api';
import classes from './customers.module.css';
import { flag, initials, type Tri } from './logic';
import { type CustomerRow, customersQuery } from './queries';

const TRI = (any: string, yes: string, no: string) => [
  { value: 'any', label: any },
  { value: '1', label: yes },
  { value: '0', label: no },
];

export function CustomersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const [blocked, setBlocked] = useState<Tri>('any');
  const [hasOrders, setHasOrders] = useState<Tri>('any');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filters: CustomerFilters = {
    page,
    pageSize,
    ...(debounced ? { q: debounced } : {}),
    ...(flag(blocked) ? { blocked: flag(blocked) } : {}),
    ...(flag(hasOrders) ? { hasOrders: flag(hasOrders) } : {}),
  };
  const list = useQuery(customersQuery(filters));

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: (c) => (
        <div className={classes.who}>
          <span className={classes.av}>{initials(c.name)}</span>
          <div>
            <b>{c.name}</b>
            <span className="sub">{c.lang === 'bn' ? 'Bangla' : 'English'}</span>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '-' },
    {
      key: 'email',
      header: 'Email',
      render: (c) => <span className={classes.muted}>{c.email ?? '-'}</span>,
    },
    { key: 'orders', header: 'Orders', className: 'num', render: (c) => c.orderCount },
    { key: 'spent', header: 'Spent', className: 'num', render: (c) => formatPrice(c.spentP) },
    {
      key: 'last',
      header: 'Last order',
      render: (c) => (c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '-'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) =>
        c.blocked ? (
          <StatusBadge tone="danger">Blocked</StatusBadge>
        ) : (
          <StatusBadge tone="ok">Active</StatusBadge>
        ),
    },
    { key: 'joined', header: 'Joined', render: (c) => formatDateTime(c.createdAt) },
  ];

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          'Customers',
        ]}
        description="Storefront accounts. Guest orders are linked once the phone is verified."
      />
      <Toolbar>
        <TextInput
          label="Search"
          placeholder="Name, phone or email"
          value={q}
          onChange={(e) => reset(() => setQ(e.currentTarget.value))}
          w={260}
        />
        <Select
          label="Status"
          w={150}
          allowDeselect={false}
          value={blocked}
          onChange={(v) => reset(() => setBlocked((v as Tri) ?? 'any'))}
          data={TRI('All', 'Blocked', 'Not blocked')}
        />
        <Select
          label="Orders"
          w={160}
          allowDeselect={false}
          value={hasOrders}
          onChange={(v) => reset(() => setHasOrders((v as Tri) ?? 'any'))}
          data={TRI('Any', 'Has orders', 'No orders yet')}
        />
      </Toolbar>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        loading={list.isLoading}
        emptyMessage="No customers match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        onRowClick={(c) => navigate({ to: '/customers/$id', params: { id: c.id } })}
      />
    </div>
  );
}
