import { createFileRoute } from '@tanstack/react-router';
import { BulkSaleDetailPage } from '~/features/bulk-sales/BulkSaleDetailPage';

export const Route = createFileRoute('/_app/promotions/bulk-sales/$id')({
  component: () => <BulkSaleDetailPage id={Route.useParams().id} />,
});
