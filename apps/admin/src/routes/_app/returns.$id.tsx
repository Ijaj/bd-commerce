import { createFileRoute } from '@tanstack/react-router';
import { ReturnDetailPage } from '~/features/returns/ReturnDetailPage';

export const Route = createFileRoute('/_app/returns/$id')({
  component: () => <ReturnDetailPage id={Route.useParams().id} />,
});
