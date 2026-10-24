import { createFileRoute } from '@tanstack/react-router';
import { NewSalePage } from '~/features/sr/NewSalePage';

export const Route = createFileRoute('/_app/sr/new-sale')({
  validateSearch: (s: Record<string, unknown>): { shop?: string } =>
    typeof s.shop === 'string' ? { shop: s.shop } : {},
  component: () => <NewSalePage initialShopId={Route.useSearch().shop} />,
});
