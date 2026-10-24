import { createFileRoute } from '@tanstack/react-router';
import { ShopsPage } from '~/features/sr/ShopsPage';

export const Route = createFileRoute('/_app/sr/shops/')({ component: ShopsPage });
