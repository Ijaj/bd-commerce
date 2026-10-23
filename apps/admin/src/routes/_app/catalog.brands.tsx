import { createFileRoute } from '@tanstack/react-router';
import { BrandsPage } from '~/features/brands/BrandsPage';

export const Route = createFileRoute('/_app/catalog/brands')({
  component: BrandsPage,
});
