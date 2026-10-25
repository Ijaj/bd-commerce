import { createFileRoute } from '@tanstack/react-router';
import { BulkSalesPage } from '~/features/bulk-sales/BulkSalesPage';

export const Route = createFileRoute('/_app/promotions/bulk-sales/')({ component: BulkSalesPage });
