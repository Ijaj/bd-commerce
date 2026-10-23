import { createFileRoute } from '@tanstack/react-router';
import { ProductEditor } from '~/features/products/ProductEditor';

export const Route = createFileRoute('/_app/catalog/products/$id')({
  component: () => <ProductEditor id={Route.useParams().id} />,
});
