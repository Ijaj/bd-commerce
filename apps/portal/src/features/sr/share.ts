import { formatPrice } from '~/lib/format';
import { type SrSaleDetail, srApi } from './api';

/** Web Share (WhatsApp etc. on phones) with a wa.me fallback. Memo link needs the SR's login for now. */
export async function shareMemo(sale: Pick<SrSaleDetail, 'id' | 'memoNo' | 'totalP' | 'shop'>) {
  const url = `${location.origin}${srApi.memoUrl(sale.id)}`;
  const text = `${sale.shop.name}: memo ${sale.memoNo}, ${formatPrice(sale.totalP)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: sale.memoNo, text, url });
      return;
    } catch {
      return; // user closed the share sheet
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
}
