import { Alert, Anchor, Breadcrumbs, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { OrderInvoicesSection } from '~/features/documents/OrderInvoicesSection';
import { OrderReturnsSection } from '~/features/returns/OrderReturnsSection';
import { OrderShipmentsSection } from '~/features/shipments/OrderShipmentsSection';
import { formatDateTime } from '~/lib/format';
import { CallBadge, PaymentBadge, RiskBadge, StatusBadge } from './badges';
import { OrderActions } from './OrderActions';
import { OrderHistoryCard, OrderInfoCards } from './OrderInfoCards';
import { OrderItemsCard } from './OrderItemsCard';
import { OrderPaymentsCard } from './OrderPaymentsCard';
import { orderQuery } from './queries';

const PLATFORM: Record<string, string> = { web: 'Web shop', sr: 'Sales rep', admin: 'Admin' };

export function OrderDetailPage({ id }: { id: string }) {
  const q = useQuery(orderQuery(id));
  const order = q.data;

  if (q.isLoading) return <Loader size="sm" aria-label="Loading" />;
  if (q.isError || !order) {
    return <Alert color="red">{(q.error as Error | null)?.message ?? 'Order not found'}</Alert>;
  }

  return (
    <Stack>
      <Breadcrumbs>
        <Link to="/orders">
          <Anchor component="span" size="sm">
            Orders
          </Anchor>
        </Link>
        <Text size="sm" fw={700}>
          {order.orderNo}
        </Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{order.orderNo}</Title>
          <Group gap="xs" mt={4}>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <CallBadge status={order.call.status} />
            <RiskBadge score={order.risk.score} reasons={order.risk.reasons} />
            <Text size="sm" c="dimmed">
              Placed {formatDateTime(order.placedAt)} · {PLATFORM[order.platform] ?? order.platform}
              {order.isPreorder ? ' · Pre-order' : ''}
            </Text>
          </Group>
        </div>
        <OrderActions order={order} />
      </Group>

      <OrderInfoCards order={order} />
      <OrderItemsCard order={order} />
      <OrderShipmentsSection orderId={order.id} />
      <OrderInvoicesSection orderId={order.id} />
      <OrderReturnsSection orderId={order.id} />
      <OrderPaymentsCard order={order} />
      <OrderHistoryCard order={order} />
    </Stack>
  );
}
