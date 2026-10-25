import { createFileRoute } from '@tanstack/react-router';
import { LabelsPrintPage } from '~/features/documents/PrintPages';
import { MAX_LABELS, parseIds } from '~/features/shipments/logic';

export const Route = createFileRoute('/_print/print/labels')({
  validateSearch: (s: Record<string, unknown>): { ids?: string } =>
    typeof s.ids === 'string' ? { ids: s.ids } : {},
  component: Page,
});

function Page() {
  const { ids } = Route.useSearch();
  return <LabelsPrintPage ids={parseIds(ids)} max={MAX_LABELS} />;
}
