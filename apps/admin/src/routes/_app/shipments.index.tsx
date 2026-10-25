import { createFileRoute } from '@tanstack/react-router';
import { ShipmentsPage } from '~/features/shipments/ShipmentsPage';

export const Route = createFileRoute('/_app/shipments/')({ component: ShipmentsPage });
