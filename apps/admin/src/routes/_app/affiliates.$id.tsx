import { createFileRoute } from '@tanstack/react-router';
import { AffiliateDetailPage } from '~/features/affiliates/AffiliateDetailPage';

export const Route = createFileRoute('/_app/affiliates/$id')({
  component: () => <AffiliateDetailPage id={Route.useParams().id} />,
});
