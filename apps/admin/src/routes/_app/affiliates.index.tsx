import { createFileRoute } from '@tanstack/react-router';
import { AffiliatesPage } from '~/features/affiliates/AffiliatesPage';

export const Route = createFileRoute('/_app/affiliates/')({ component: AffiliatesPage });
