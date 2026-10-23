import { createFileRoute } from '@tanstack/react-router';
import { ComingNext } from '~/components/ComingNext';

export const Route = createFileRoute('/_app/catalog/import-export')({
  component: () => <ComingNext title="Import / Export" />,
});
