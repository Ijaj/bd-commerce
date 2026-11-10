import { createFileRoute } from '@tanstack/react-router';
import { CustomerDetailPage } from '~/features/customers/CustomerDetailPage';

export const Route = createFileRoute('/_app/customers/$id')({
  component: () => <CustomerDetailPage id={Route.useParams().id} />,
});
