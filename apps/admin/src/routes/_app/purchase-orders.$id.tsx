import { createFileRoute } from '@tanstack/react-router';
import { PoEditorPage } from '~/features/purchase-orders/PoEditorPage';

export const Route = createFileRoute('/_app/purchase-orders/$id')({
  component: () => <PoEditorPage id={Route.useParams().id} />,
});
