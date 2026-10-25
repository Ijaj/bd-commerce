import { createFileRoute } from '@tanstack/react-router';
import { BulkSaleNewPage } from '~/features/bulk-sales/BulkSaleNewPage';

export const Route = createFileRoute('/_app/promotions/bulk-sales/new')({
  component: BulkSaleNewPage,
});
