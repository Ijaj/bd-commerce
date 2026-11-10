import { createFileRoute } from '@tanstack/react-router';
import { PagesPage } from '~/features/pages/PagesPage';

export const Route = createFileRoute('/_app/content/pages/')({
  component: PagesPage,
});
