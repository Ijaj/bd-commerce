import { createFileRoute } from '@tanstack/react-router';
import { ShopDetailPage } from '~/features/b2b/ShopDetailPage';

export const Route = createFileRoute('/_app/b2b/shops/$id')({
  component: () => <ShopDetailPage id={Route.useParams().id} />,
});
