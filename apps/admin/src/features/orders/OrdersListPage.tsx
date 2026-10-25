import { Banner } from '@bdc/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { CallBadge, PaymentBadge, RiskBadge, StatusBadge } from './badges';
import { type FilterState, OrderFilterBar } from './OrderFilters';
import classes from './Orders.module.css';
import { type OrderListItem, ordersQuery } from './queries';

const columns: Column<OrderListItem>[] = [
  {
    key: 'no',
    header: 'Order',
    render: (o) => (
      <div>
        <Link to="/orders/$id" params={{ id: o.id }} className={classes.orderNo}>
          {o.orderNo}
        </Link>
        <span className={classes.sub}>{formatDateTime(o.placedAt)}</span>
      </div>
    ),
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (o) => (
      <div>
        <b>
          {o.customer.name}
          {o.customer.isGuest ? ' (guest)' : ''}
        </b>
        <span className={classes.sub}>
          {o.customer.phone} · {o.shipPlaceText}
        </span>
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
        <b>{formatPrice(o.grandTotalP)}</b>
        {o.codDueP > 0 && <span className={classes.sub}>COD {formatPrice(o.codDueP)}</span>}
      </div>
    ),
  },
  {
    key: 'payment',
    header: 'Payment',
    render: (o) => (
      <div className={classes.row}>
        <PaymentBadge status={o.paymentStatus} />
        <CallBadge status={o.callStatus} />
      </div>
    ),
  },
  { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  {
    key: 'risk',
    header: 'Risk',
    render: (o) =>
      o.riskReasons.length === 0 ? (
        <span className={classes.muted}>–</span>
      ) : (
        <RiskBadge score={o.riskScore} reasons={o.riskReasons} />
      ),
  },
  {
    key: 'ship',
    header: 'Courier',
    render: (o) =>
      o.shipmentSummary.total === 0 ? (
        <span className={classes.muted}>Not booked</span>
      ) : (
        `${o.shipmentSummary.delivered}/${o.shipmentSummary.total} delivered`
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
      <PageHeader
        title="Orders"
        crumbs={['Sales', 'Orders']}
        description="Every order, newest first."
      />
      <OrderFilterBar
        value={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      {list.isError && (
        <div className={classes.errorCard}>
          <Banner tone="danger">{(list.error as Error).message}</Banner>
        </div>
      )}
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
