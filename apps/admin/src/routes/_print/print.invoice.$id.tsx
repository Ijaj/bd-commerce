import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { InvoicePrintPage } from '~/features/documents/PrintPages';

export const Route = createFileRoute('/_print/print/invoice/$id')({
  validateSearch: (s: Record<string, unknown>): { lang?: 'en' | 'bn' } =>
    s.lang === 'bn' || s.lang === 'en' ? { lang: s.lang } : {},
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { lang } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <InvoicePrintPage
      id={id}
      lang={lang}
      onLang={(l) => navigate({ search: { lang: l }, replace: true })}
    />
  );
}
