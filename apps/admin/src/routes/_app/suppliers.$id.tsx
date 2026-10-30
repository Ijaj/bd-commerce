import { createFileRoute } from '@tanstack/react-router';
import { SupplierDetailPage } from '~/features/suppliers/SupplierDetailPage';

export const Route = createFileRoute('/_app/suppliers/$id')({
  component: () => <SupplierDetailPage id={Route.useParams().id} />,
});
