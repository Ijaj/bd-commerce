import { createFileRoute } from '@tanstack/react-router';
import { CollectionsPage } from '~/features/b2b/CollectionsPage';

export const Route = createFileRoute('/_app/b2b/collections')({ component: CollectionsPage });
