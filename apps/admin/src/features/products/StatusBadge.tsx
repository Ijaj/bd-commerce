import { type Tone, StatusBadge as UiStatusBadge } from '@bdc/ui';
import type { ProductStatus } from './types';

// plan/mockups/admin/shared/page-products.js stBadge: active ok, draft warn, anything else muted.
const TONES: Record<ProductStatus, Tone> = {
  draft: 'warn',
  active: 'ok',
  archived: 'muted',
};

/** Active with a future publish time (C8): not visible in the shop yet. */
export function isScheduled(status: ProductStatus, publishedAt: string | null | undefined) {
  return status === 'active' && !!publishedAt && new Date(publishedAt).getTime() > Date.now();
}

export function StatusBadge({
  status,
  publishedAt,
}: {
  status: ProductStatus;
  publishedAt?: string | null;
}) {
  if (isScheduled(status, publishedAt)) {
    return (
      <UiStatusBadge
        tone="info"
        title={`Visible from ${new Date(publishedAt as string).toLocaleString()}`}
      >
        Scheduled
      </UiStatusBadge>
    );
  }
  return <UiStatusBadge tone={TONES[status]}>{status}</UiStatusBadge>;
}
