import { createFileRoute } from '@tanstack/react-router';
import { FlashSaleEditorPage } from '~/features/flash-sales/FlashSaleEditorPage';

export const Route = createFileRoute('/_app/promotions/flash-sales/new')({
  component: () => <FlashSaleEditorPage />,
});
