import { createFileRoute } from '@tanstack/react-router';
import { SrSetupPage } from '~/features/sr/SrSetupPage';

export const Route = createFileRoute('/_app/sr/team')({ component: SrSetupPage });
