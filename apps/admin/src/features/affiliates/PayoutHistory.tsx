import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { formatDateTime, formatPrice } from '~/lib/format';
import classes from './affiliates.module.css';
import { methodLabel } from './logic';
import { type PayoutRow, payoutsQuery } from './queries';

/** Paid-out history; all affiliates, or one when `affiliateId` is given. */
export function PayoutHistory({ affiliateId }: { affiliateId?: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const list = useQuery(payoutsQuery({ page, pageSize, ...(affiliateId ? { affiliateId } : {}) }));

  const columns: Column<PayoutRow>[] = [
    { key: 'at', header: 'Paid', className: 'a-nowrap', render: (p) => formatDateTime(p.paidAt) },
    ...(affiliateId
      ? []
      : [
          {
            key: 'aff',
            header: 'Affiliate',
            render: (p: PayoutRow) => (
              <span>
                <b>{p.affiliate.displayName}</b>
                <span className="sub">{p.affiliate.code}</span>
              </span>
            ),
          },
        ]),
    { key: 'period', header: 'Period', render: (p) => p.period },
    {
      key: 'amount',
      header: 'Amount',
      className: 'num',
      render: (p) => <b>{formatPrice(p.amountP)}</b>,
    },
    { key: 'method', header: 'Method', render: (p) => methodLabel(p.method) },
    {
      key: 'ref',
      header: 'Reference',
      render: (p) => (
        <span>
          {p.reference}
          {p.note && <span className="sub">{p.note}</span>}
        </span>
      ),
    },
    { key: 'by', header: 'Paid by', render: (p) => p.paidBy.name },
  ];

  return (
    <DataTable
      columns={columns}
      rows={list.data?.items}
      rowKey={(p) => p.id}
      loading={list.isLoading}
      emptyMessage={<span className={classes.muted}>No payouts recorded yet.</span>}
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
  );
}
