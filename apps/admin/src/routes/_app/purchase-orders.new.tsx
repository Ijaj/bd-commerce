import { createFileRoute } from '@tanstack/react-router';
import { PoEditorPage } from '~/features/purchase-orders/PoEditorPage';

export const Route = createFileRoute('/_app/purchase-orders/new')({
  validateSearch: (s: Record<string, unknown>): { supplierId?: string } =>
    typeof s.supplierId === 'string' && s.supplierId ? { supplierId: s.supplierId } : {},
  component: Page,
});

function Page() {
  return <PoEditorPage supplierId={Route.useSearch().supplierId} />;
}
