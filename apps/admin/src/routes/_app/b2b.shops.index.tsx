import { createFileRoute } from '@tanstack/react-router';
import { ShopsPage } from '~/features/b2b/ShopsPage';

export const Route = createFileRoute('/_app/b2b/shops/')({ component: ShopsPage });
