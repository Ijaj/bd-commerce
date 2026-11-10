import { createFileRoute } from '@tanstack/react-router';
import { PageEditorPage } from '~/features/pages/PageEditorPage';

export const Route = createFileRoute('/_app/content/pages/$id')({
  component: () => <PageEditorPage id={Route.useParams().id} />,
});
