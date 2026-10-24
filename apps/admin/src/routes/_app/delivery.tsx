import { createFileRoute } from '@tanstack/react-router';
import { DeliveryPage } from '~/features/delivery/DeliveryPage';

export const Route = createFileRoute('/_app/delivery')({ component: DeliveryPage });
