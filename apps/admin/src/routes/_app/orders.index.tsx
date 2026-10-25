import { createFileRoute } from '@tanstack/react-router';
import { OrdersListPage } from '~/features/orders/OrdersListPage';

export const Route = createFileRoute('/_app/orders/')({ component: OrdersListPage });
