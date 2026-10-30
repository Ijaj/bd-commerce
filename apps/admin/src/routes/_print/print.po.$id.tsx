import { createFileRoute } from '@tanstack/react-router';
import { PoPrintPage } from '~/features/purchase-orders/PoPrintView';

export const Route = createFileRoute('/_print/print/po/$id')({
  component: () => <PoPrintPage id={Route.useParams().id} />,
});
