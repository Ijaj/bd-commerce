import { Alert, Anchor, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { OrderBadges } from './badges';
import { type FilterState, OrderFilterBar } from './OrderFilters';
import { type OrderListItem, ordersQuery } from './queries';

const columns: Column<OrderListItem>[] = [
  {
    key: 'no',
    header: 'Order',
    render: (o) => (
      <div>
        <Link to="/orders/$id" params={{ id: o.id }}>
          <Anchor component="span" size="sm">
            {o.orderNo}
          </Anchor>
        </Link>
        <Text size="xs" c="dimmed">
          {formatDateTime(o.placedAt)}
        </Text>
      </div>
    ),
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (o) => (
      <div>
        <Text size="sm">
          {o.customer.name}
          {o.customer.isGuest ? ' (guest)' : ''}
        </Text>
        <Text size="xs" c="dimmed">
          {o.customer.phone} · {o.shipPlaceText}
        </Text>
      </div>
    ),
  },
  { key: 'items', header: 'Items', align: 'right', render: (o) => o.itemCount },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    render: (o) => (
      <div>
        <Text size="sm">{formatPrice(o.grandTotalP)}</Text>
        {o.codDueP > 0 && (
          <Text size="xs" c="dimmed">
            COD {formatPrice(o.codDueP)}
          </Text>
        )}
      </div>
    ),
  },
  {
    key: 'ship',
    header: 'Shipments',
    render: (o) =>
      o.shipmentSummary.total === 0
        ? '-'
        : `${o.shipmentSummary.delivered}/${o.shipmentSummary.total} delivered`,
  },
  {
    key: 'state',
    header: 'State',
    render: (o) => (
      <OrderBadges
        status={o.status}
        paymentStatus={o.paymentStatus}
        callStatus={o.callStatus}
        riskScore={o.riskScore}
        riskReasons={o.riskReasons}
      />
    ),
  },
];

export function OrdersListPage() {
  const [filters, setFilters] = useState<FilterState>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const list = useQuery(ordersQuery({ ...filters, page, pageSize }));

  return (
    <div>
      <PageHeader title="Orders" description="Every order, newest first." />
      <OrderFilterBar
        value={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(o) => o.id}
        loading={list.isLoading}
        emptyMessage="No orders match these filters."
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
