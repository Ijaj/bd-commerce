import { createFileRoute } from '@tanstack/react-router';
import { ProductsList, validateProductsSearch } from '~/features/products/ProductsList';

export const Route = createFileRoute('/_app/catalog/products/')({
  validateSearch: validateProductsSearch,
  component: () => <ProductsList search={Route.useSearch()} />,
});
