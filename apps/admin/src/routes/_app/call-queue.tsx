import { createFileRoute } from '@tanstack/react-router';
import { CallQueuePage } from '~/features/orders/CallQueuePage';

export const Route = createFileRoute('/_app/call-queue')({ component: CallQueuePage });
