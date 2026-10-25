import { Link } from '@tanstack/react-router';
import { StatusBadge } from '~/components/StatusBadge';
import { t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import type { SrSaleSummary } from './api';

/** One row in a sale list (home + my sales): mockup `.sr-item`. */
export function SaleItem({ sale }: { sale: SrSaleSummary }) {
  return (
    <Link to="/sr/sales/$id" params={{ id: sale.id }} className="sr-item">
      <div className="t">
        <span>{sale.shop.name}</span>
        <StatusBadge status={sale.status} />
      </div>
      <div className="s">
        <span>
          {formatDate(sale.submittedAt)} · {sale.memoNo}
        </span>
        <span>
          <b>{formatPrice(sale.totalP)}</b>
          {sale.dueP > 0 && sale.status !== 'rejected' && sale.status !== 'cancelled' && (
            <span className="sr-due">
              {' '}
              · {t('due')} {formatPrice(sale.dueP)}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
