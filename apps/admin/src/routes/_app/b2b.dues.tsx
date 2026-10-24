import { createFileRoute } from '@tanstack/react-router';
import { DuesPage } from '~/features/b2b/DuesPage';

export const Route = createFileRoute('/_app/b2b/dues')({ component: DuesPage });
