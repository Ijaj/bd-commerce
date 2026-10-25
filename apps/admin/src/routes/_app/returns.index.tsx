import { createFileRoute } from '@tanstack/react-router';
import { ReturnsPage } from '~/features/returns/ReturnsPage';

export const Route = createFileRoute('/_app/returns/')({ component: ReturnsPage });
