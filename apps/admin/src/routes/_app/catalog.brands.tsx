import { createFileRoute } from '@tanstack/react-router';
import { ComingNext } from '~/components/ComingNext';

export const Route = createFileRoute('/_app/catalog/brands')({
  component: () => <ComingNext title="Brands" />,
});
