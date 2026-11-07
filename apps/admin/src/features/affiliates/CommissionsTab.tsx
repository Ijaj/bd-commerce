import { Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { formatDateTime, formatPrice } from '~/lib/format';
import classes from './affiliates.module.css';
import type { CommissionStatus } from './api';
import { CommissionBadge } from './components';
import { formatBp } from './logic';
import { type CommissionRow, commissionsQuery } from './queries';

const ANY = 'any';

export function CommissionsTab({ affiliateId }: { affiliateId: string }) {
  const [status, setStatus] = useState(ANY);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const list = useQuery(
    commissionsQuery(affiliateId, {
      page,
      pageSize,
      ...(status !== ANY ? { status: status as CommissionStatus } : {}),
    }),
  );

  const columns: Column<CommissionRow>[] = [
    {
      key: 'at',
      header: 'Placed',
      className: 'a-nowrap',
      render: (c) => formatDateTime(c.placedAt),
    },
    {
      key: 'order',
      header: 'Order',
      render: (c) => (
        <Link to="/orders/$id" params={{ id: c.order.id }}>
          {c.order.orderNo}
        </Link>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (c) => (
        <span>
          {c.firstItemTitle ?? '-'}
          {c.itemCount > 1 && <span className={classes.muted}> +{c.itemCount - 1} more</span>}
        </span>
      ),
    },
    {
      key: 'via',
      header: 'Via',
      render: (c) => (c.attribution === 'code' ? 'Code' : 'Link'),
    },
    { key: 'base', header: 'Base', className: 'num', render: (c) => formatPrice(c.baseP) },
    { key: 'rate', header: 'Rate', className: 'num', render: (c) => formatBp(c.commissionBp) },
    {
      key: 'amount',
      header: 'Commission',
      className: 'num',
      render: (c) => <b>{formatPrice(c.amountP)}</b>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <span>
          <CommissionBadge status={c.status} />
          {c.status === 'reversed' && c.reverseReason && (
            <span className="sub">{c.reverseReason.replace(/_/g, ' ')}</span>
          )}
          {c.status === 'pending' && c.availableAt && (
            <span className="sub">available {formatDateTime(c.availableAt)}</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Select
          label="Status"
          w={160}
          allowDeselect={false}
          value={status}
          onChange={(v) => {
            setStatus(v ?? ANY);
            setPage(1);
          }}
          data={[
            { value: ANY, label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'paid', label: 'Paid' },
            { value: 'reversed', label: 'Reversed' },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        loading={list.isLoading}
        emptyMessage={<span className={classes.muted}>No commissions yet.</span>}
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        pageSizeOptions={[25, 50, 100]}
      />
    </div>
  );
}
