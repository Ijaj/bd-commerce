import { createFileRoute } from '@tanstack/react-router';
import { LabelPrintPage } from '~/features/documents/PrintPages';

export const Route = createFileRoute('/_print/print/label/$id')({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return <LabelPrintPage id={id} />;
}
