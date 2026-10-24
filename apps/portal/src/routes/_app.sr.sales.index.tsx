import { createFileRoute } from '@tanstack/react-router';
import { SalesPage } from '~/features/sr/SalesPage';

export const Route = createFileRoute('/_app/sr/sales/')({ component: SalesPage });
