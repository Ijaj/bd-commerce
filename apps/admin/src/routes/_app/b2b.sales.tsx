import { createFileRoute } from '@tanstack/react-router';
import { SalesPage, validateSalesSearch } from '~/features/sr/SalesPage';

export const Route = createFileRoute('/_app/b2b/sales')({
  validateSearch: validateSalesSearch,
  component: () => <SalesPage search={Route.useSearch()} />,
});
