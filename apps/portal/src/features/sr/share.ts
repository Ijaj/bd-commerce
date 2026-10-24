import { getLang, t } from '~/i18n';
import { formatPrice } from '~/lib/format';
import { srApi } from './api';

/**
 * Creates the public memo link (C38) and hands a short message to the share sheet
 * (WhatsApp etc. on phones), or to wa.me on desktop. Throws if the link cannot be made.
 */
export async function shareMemo(sale: {
  id: string;
  memoNo: string;
  totalP: number;
  dueP: number;
}) {
  const { url } = await srApi.memoLink(sale.id);
  const text = t('shareMessage', {
    memo: sale.memoNo,
    total: formatPrice(sale.totalP),
    due: formatPrice(sale.dueP),
    url: `${url}${url.includes('?') ? '&' : '?'}lang=${getLang()}`,
  });
  if (navigator.share) {
    try {
      await navigator.share({ title: sale.memoNo, text });
    } catch {
      // user closed the share sheet
    }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
