import { createFileRoute } from '@tanstack/react-router';
import { SaleDetailPage } from '~/features/sr/SaleDetailPage';

export const Route = createFileRoute('/_app/sr/sales/$id')({
  component: () => <SaleDetailPage id={Route.useParams().id} />,
});
