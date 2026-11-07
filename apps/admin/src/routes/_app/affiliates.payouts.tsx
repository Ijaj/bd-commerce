import { createFileRoute } from '@tanstack/react-router';
import { PayoutsPage } from '~/features/affiliates/PayoutsPage';

export const Route = createFileRoute('/_app/affiliates/payouts')({ component: PayoutsPage });
