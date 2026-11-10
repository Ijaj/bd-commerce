import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PaymentBadge, StatusBadge } from '~/features/orders/badges';
import { formatDateTime, formatPrice } from '~/lib/format';
import { type CustomerOrderRow, customerOrdersQuery } from './queries';

type OrderStatus = Parameters<typeof StatusBadge>[0]['status'];
type PaymentStatus = Parameters<typeof PaymentBadge>[0]['status'];

export function OrdersTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const q = useQuery(customerOrdersQuery(customerId, { page, pageSize }));

  const columns: Column<CustomerOrderRow>[] = [
    {
      key: 'no',
      header: 'Order',
      render: (o) => (
        <Link to="/orders/$id" params={{ id: o.id }}>
          #{o.orderNo}
        </Link>
      ),
    },
    { key: 'date', header: 'Date', render: (o) => formatDateTime(o.placedAt) },
    { key: 'items', header: 'Items', className: 'num', render: (o) => o.itemCount },
    { key: 'total', header: 'Total', className: 'num', render: (o) => formatPrice(o.grandTotalP) },
    {
      key: 'pay',
      header: 'Payment',
      render: (o) => <PaymentBadge status={o.paymentStatus as PaymentStatus} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => <StatusBadge status={o.status as OrderStatus} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={q.data?.items}
      rowKey={(o) => o.id}
      loading={q.isLoading}
      emptyMessage="No orders yet."
      page={page}
      pageSize={pageSize}
      total={q.data?.total}
      onPageChange={setPage}
    />
  );
}
