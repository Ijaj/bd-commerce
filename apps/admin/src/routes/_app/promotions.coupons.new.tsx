import { createFileRoute } from '@tanstack/react-router';
import { CouponEditorPage } from '~/features/coupons/CouponEditorPage';

export const Route = createFileRoute('/_app/promotions/coupons/new')({
  component: () => <CouponEditorPage />,
});
