import { createFileRoute } from '@tanstack/react-router';
import { CollectionsPage } from '~/features/sr/CollectionsPage';

export const Route = createFileRoute('/_app/sr/collections')({
  validateSearch: (s: Record<string, unknown>): { shop?: string } =>
    typeof s.shop === 'string' ? { shop: s.shop } : {},
  component: () => <CollectionsPage initialShopId={Route.useSearch().shop} />,
});
