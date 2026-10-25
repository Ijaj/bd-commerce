import { createFileRoute } from '@tanstack/react-router';
import { FlashSalesPage } from '~/features/flash-sales/FlashSalesPage';

export const Route = createFileRoute('/_app/promotions/flash-sales/')({
  component: FlashSalesPage,
});
