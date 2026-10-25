import { createFileRoute } from '@tanstack/react-router';
import { RefundsPage } from '~/features/returns/RefundsPage';

export const Route = createFileRoute('/_app/refunds/')({ component: RefundsPage });
