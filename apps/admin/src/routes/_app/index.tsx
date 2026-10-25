import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '~/features/shell/Dashboard';

export const Route = createFileRoute('/_app/')({ component: Dashboard });
