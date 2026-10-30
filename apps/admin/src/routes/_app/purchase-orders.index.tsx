import { createFileRoute } from '@tanstack/react-router';
import { PurchaseOrdersPage } from '~/features/purchase-orders/PurchaseOrdersPage';

export const Route = createFileRoute('/_app/purchase-orders/')({ component: PurchaseOrdersPage });
