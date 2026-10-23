import { createFileRoute } from '@tanstack/react-router';
import { InventoryPage } from '~/features/inventory/InventoryPage';
import { parseInventorySearch } from '~/features/inventory/search';

export const Route = createFileRoute('/_app/catalog/inventory')({
  validateSearch: parseInventorySearch,
  component: InventoryRoute,
});

function InventoryRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InventoryPage
      search={search}
      onSearch={(patch) =>
        navigate({
          search: (prev) => parseInventorySearch({ ...prev, ...patch }),
          replace: true,
        })
      }
    />
  );
}
