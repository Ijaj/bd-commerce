import { Toolbar } from '@bdc/ui';
import { Alert, Button, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import classes from './affiliates.module.css';
import type { AffiliateFilters } from './api';
import { AffiliateStatusBadge, CodeChip } from './components';
import { formatBp } from './logic';
import { type AffiliateRow, affiliatesQuery } from './queries';

const ANY = 'any';

export function AffiliatesPage() {
  const navigate = useNavigate();
  const canPay = useCan('affiliate_payouts.manage');
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const [status, setStatus] = useState(ANY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filters: AffiliateFilters = {
    page,
    pageSize,
    ...(debounced ? { q: debounced } : {}),
    ...(status !== ANY ? { status: status as 'active' | 'suspended' } : {}),
  };
  const list = useQuery(affiliatesQuery(filters));

  const columns: Column<AffiliateRow>[] = [
    { key: 'code', header: 'Code', render: (a) => <CodeChip code={a.code} /> },
    {
      key: 'name',
      header: 'Affiliate',
      render: (a) => (
        <div style={{ minWidth: 180 }}>
          <b>{a.displayName}</b>
          <span className="sub">
            {a.customer.name}
            {a.customer.phone ? ` · ${a.customer.phone}` : ''}
          </span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (a) => <AffiliateStatusBadge status={a.status} /> },
    {
      key: 'rate',
      header: 'Rate',
      className: 'num',
      render: (a) => (
        <span title={a.rateOverridden ? 'Custom rate for this affiliate' : 'Programme default'}>
          {formatBp(a.commissionBp)}
          {a.rateOverridden && '*'}
        </span>
      ),
    },
    { key: 'clicks', header: 'Clicks 30d', className: 'num', render: (a) => a.clicks30 },
    { key: 'orders', header: 'Orders 30d', className: 'num', render: (a) => a.orders30 },
    { key: 'pending', header: 'Pending', className: 'num', render: (a) => formatPrice(a.pendingP) },
    { key: 'balance', header: 'Balance', className: 'num', render: (a) => formatPrice(a.balanceP) },
    { key: 'paid', header: 'Paid', className: 'num', render: (a) => formatPrice(a.paidP) },
  ];

  return (
    <div>
      <PageHeader
        title="Affiliates"
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          'Affiliates',
        ]}
        description="Customers who refer buyers with a link or code and earn commission."
        actions={
          <>
            {canPay && (
              <Button component={Link} to="/affiliates/payouts" variant="default">
                Payouts
              </Button>
            )}
            <Button component={Link} to="/settings" variant="default">
              Programme settings
            </Button>
          </>
        }
      />
      <Toolbar>
        <TextInput
          label="Search"
          placeholder="Code, name, phone or email"
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
          value={status}
          onChange={(v) => {
            setStatus(v ?? ANY);
            setPage(1);
          }}
          data={[
            { value: ANY, label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
      </Toolbar>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(a) => a.id}
        loading={list.isLoading}
        emptyMessage={
          <span className={classes.muted}>
            No affiliates yet. Customers join from their account page.
          </span>
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
        onRowClick={(a) => navigate({ to: '/affiliates/$id', params: { id: a.id } })}
      />
      <p className={classes.muted} style={{ fontSize: 12 }}>
        * custom rate for this affiliate. New rates apply to new orders only.
      </p>
    </div>
  );
}
