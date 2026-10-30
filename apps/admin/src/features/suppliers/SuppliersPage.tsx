import { Icon, Toolbar } from '@bdc/ui';
import { Alert, Button, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { useCan } from '~/lib/perm';
import { AddSupplierModal } from './AddSupplierModal';
import type { SupplierFilters } from './api';
import { ActiveBadge, Balance } from './components';
import { SHIP_MODE_LABEL } from './logic';
import { type SupplierRow, suppliersQuery } from './queries';
import classes from './suppliers.module.css';

const ANY = 'any';

export function SuppliersPage() {
  const navigate = useNavigate();
  const canManage = useCan('suppliers.manage');
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const [active, setActive] = useState(ANY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [adding, setAdding] = useState(false);

  const filters: SupplierFilters = {
    page,
    pageSize,
    ...(debounced ? { q: debounced } : {}),
    ...(active !== ANY ? { active: active as 'true' | 'false' } : {}),
  };
  const list = useQuery(suppliersQuery(filters));

  const columns: Column<SupplierRow>[] = [
    {
      key: 'supplier',
      header: 'Supplier',
      render: (s) => (
        <div>
          <b>{s.name}</b>
          {s.phone && <span className="sub">{s.phone}</span>}
        </div>
      ),
    },
    { key: 'contact', header: 'Contact', render: (s) => s.contactName ?? '-' },
    { key: 'ship', header: 'Ship mode', render: (s) => SHIP_MODE_LABEL[s.shipMode] },
    { key: 'products', header: 'Products', className: 'num', render: (s) => s.productCount },
    { key: 'open', header: 'Open POs', className: 'num', render: (s) => s.openPoCount },
    {
      key: 'balance',
      header: 'Balance owed',
      className: 'num',
      render: (s) => <Balance balanceP={s.balanceP} />,
    },
    { key: 'status', header: 'Status', render: (s) => <ActiveBadge active={s.isActive} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers & POs"
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          'Suppliers & POs',
        ]}
        description="Who we buy stock from, what we owe them, and what is on order."
        actions={
          <>
            <Button
              component={Link}
              to="/purchase-orders"
              variant="default"
              leftSection={<Icon name="po" size={16} />}
            >
              Purchase orders
            </Button>
            {canManage && (
              <Button leftSection={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
                Add supplier
              </Button>
            )}
          </>
        }
      />
      <Toolbar>
        <TextInput
          label="Search"
          placeholder="Name, contact or phone"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
          w={260}
        />
        <Select
          label="Status"
          w={150}
          allowDeselect={false}
          value={active}
          onChange={(v) => {
            setActive(v ?? ANY);
            setPage(1);
          }}
          data={[
            { value: ANY, label: 'All' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Paused' },
          ]}
        />
      </Toolbar>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(s) => s.id}
        loading={list.isLoading}
        emptyMessage={
          <span className={classes.muted}>No suppliers match. Add one to start buying stock.</span>
        }
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(s) => navigate({ to: '/suppliers/$id', params: { id: s.id } })}
      />
      {adding && (
        <AddSupplierModal
          onClose={() => setAdding(false)}
          onCreated={(s) => {
            setAdding(false);
            navigate({ to: '/suppliers/$id', params: { id: s.id } });
          }}
        />
      )}
    </div>
  );
}
