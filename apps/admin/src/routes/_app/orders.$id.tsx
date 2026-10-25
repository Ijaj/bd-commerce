import { createFileRoute } from '@tanstack/react-router';
import { OrderDetailPage } from '~/features/orders/OrderDetailPage';

export const Route = createFileRoute('/_app/orders/$id')({
  component: () => <OrderDetailPage id={Route.useParams().id} />,
});
