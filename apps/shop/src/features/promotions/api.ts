import { apiGet } from '~/lib/api';
import type { FlashPublic, PublicCoupon } from './types';

const SOON = 30;

/** Live and upcoming flash sales. Fails soft: offers are never worth breaking a page for. */
export async function fetchFlashSales(): Promise<FlashPublic | null> {
  try {
    return await apiGet<FlashPublic>('/v1/public/flash-sales', undefined, { revalidate: SOON });
  } catch {
    return null;
  }
}

/** Anonymous copy of the public coupons (signed-in shoppers refetch in the browser). */
export async function fetchPublicCoupons(): Promise<PublicCoupon[] | null> {
  try {
    const r = await apiGet<{ items: PublicCoupon[] }>('/v1/public/coupons', undefined, {
      revalidate: SOON,
    });
    return r?.items ?? null;
  } catch {
    return null;
  }
}
