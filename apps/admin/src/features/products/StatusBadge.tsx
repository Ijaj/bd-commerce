import { type Tone, StatusBadge as UiStatusBadge } from '@bdc/ui';
import type { ProductStatus } from './types';

// plan/mockups/admin/shared/page-products.js stBadge: active ok, draft warn, anything else muted.
const TONES: Record<ProductStatus, Tone> = {
  draft: 'warn',
  active: 'ok',
  archived: 'muted',
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <UiStatusBadge tone={TONES[status]}>{status}</UiStatusBadge>;
}
