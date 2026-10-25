import { Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { RefundStatusBadge } from './components';
import { REFUND_STATUS_LABEL } from './logic';
import { type RefundRow, type RefundStatus, refundsQuery } from './queries';
import { RefundDetailModal } from './RefundDetailModal';

const STATUS_OPTIONS = (Object.keys(REFUND_STATUS_LABEL) as RefundStatus[]).map((value) => ({
  value,
  label: REFUND_STATUS_LABEL[value],
}));

export function RefundsPage() {
  const [status, setStatus] = useState<RefundStatus | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery(refundsQuery({ status: status ?? undefined, page, pageSize }));

  const columns: Column<RefundRow>[] = [
    { key: 'at', header: 'Requested', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'order',
      header: 'Order',
      render: (r) => (
        <Link to="/orders/$id" params={{ id: r.orderId }} onClick={(e) => e.stopPropagation()}>
          {r.orderNo}
        </Link>
      ),
    },
    {
      key: 'kind',
      header: 'Type',
      render: (r) => (r.returnId ? 'Return' : 'Order refund'),
    },
    {
      key: 'method',
      header: 'Method',
      render: (r) => (r.method === 'wallet' ? 'Wallet' : 'Original'),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatPrice(r.amountP) },
    { key: 'by', header: 'Requested by', render: (r) => r.requestedByName ?? '-' },
    { key: 'status', header: 'Status', render: (r) => <RefundStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Refunds" description="Refund requests waiting for approval or payout." />
      <Select
        label="Status"
        placeholder="All"
        clearable
        mb="md"
        data={STATUS_OPTIONS}
        value={status}
        onChange={(v) => {
          setStatus(v as RefundStatus | null);
          setPage(1);
        }}
        w={220}
      />
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage="No refunds match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        onRowClick={(r) => setOpenId(r.id)}
      />
      <RefundDetailModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
