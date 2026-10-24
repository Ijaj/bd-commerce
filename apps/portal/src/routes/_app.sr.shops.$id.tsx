import { createFileRoute } from '@tanstack/react-router';
import { ShopDetailPage } from '~/features/sr/ShopDetailPage';

export const Route = createFileRoute('/_app/sr/shops/$id')({
  component: () => <ShopDetailPage id={Route.useParams().id} />,
});
