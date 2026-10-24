import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '~/features/sr/HomePage';

export const Route = createFileRoute('/_app/sr/')({ component: HomePage });
