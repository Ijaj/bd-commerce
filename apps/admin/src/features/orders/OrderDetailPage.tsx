import { Banner } from '@bdc/ui';
import { Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '~/components/PageHeader';
import { OrderInvoicesSection } from '~/features/documents/OrderInvoicesSection';
import { OrderReturnsSection } from '~/features/returns/OrderReturnsSection';
import { OrderShipmentsSection } from '~/features/shipments/OrderShipmentsSection';
import { formatDateTime } from '~/lib/format';
import { CallBadge, PaymentBadge, RiskBadge, StatusBadge } from './badges';
import { OrderActions } from './OrderActions';
import { OrderHistoryCard, OrderInfoCards } from './OrderInfoCards';
import { OrderItemsCard } from './OrderItemsCard';
import { OrderPaymentsCard } from './OrderPaymentsCard';
import classes from './Orders.module.css';
import { orderQuery } from './queries';

const PLATFORM: Record<string, string> = { web: 'Web shop', sr: 'Sales rep', admin: 'Admin' };

export function OrderDetailPage({ id }: { id: string }) {
  const q = useQuery(orderQuery(id));
  const order = q.data;

  if (q.isLoading) {
    return (
      <div className="a-card">
        <div className="a-empty" role="status" aria-label="Loading">
          <Loader size="sm" />
        </div>
      </div>
    );
  }
  if (q.isError || !order) {
    return <Banner tone="danger">{(q.error as Error | null)?.message ?? 'Order not found'}</Banner>;
  }

  return (
    <>
      <PageHeader
        title={order.orderNo}
        crumbs={[
          'Sales',
          <Link key="orders" to="/orders">
            Orders
          </Link>,
          order.orderNo,
        ]}
        actions={<OrderActions order={order} />}
      />
      <div className={classes.head}>
        <div>
          <h2>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <CallBadge status={order.call.status} />
            <RiskBadge score={order.risk.score} reasons={order.risk.reasons} />
          </h2>
          <div className={classes.headMeta}>
            Placed {formatDateTime(order.placedAt)} · {PLATFORM[order.platform] ?? order.platform}
            {order.isPreorder ? ' · Pre-order' : ''}
          </div>
        </div>
      </div>

      <div className={classes.layout}>
        <div className={classes.col}>
          <OrderItemsCard order={order} />
          <OrderShipmentsSection orderId={order.id} />
          <OrderInvoicesSection orderId={order.id} />
          <OrderReturnsSection orderId={order.id} />
          <OrderPaymentsCard order={order} />
        </div>
        <div className={classes.col}>
          <OrderInfoCards order={order} />
          <OrderHistoryCard order={order} />
        </div>
      </div>
    </>
  );
}
