import { Icon } from '@bdc/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { num, t } from '~/i18n';
import { srPendingQuery } from './queries';

/** Mockup `.sr-tabbar`: 5 tabs, the centre "new sale" tab is the accent FAB. */
export function SrTabBar() {
  const { data: pending = 0 } = useQuery(srPendingQuery);
  // Link sets data-status="active" on the current tab; styles.css colours it.
  return (
    <nav className="sr-tabbar" aria-label="Main">
      <Link to="/sr" activeOptions={{ exact: true }}>
        <Icon name="home" size={21} />
        <span>{t('tabHome')}</span>
      </Link>
      <Link to="/sr/sales">
        <Icon name="orders" size={21} />
        <span>{t('tabSales')}</span>
        {pending > 0 && <b className="n">{num(pending)}</b>}
      </Link>
      <Link to="/sr/new-sale" className="fab">
        <span className="c">
          <Icon name="plus" size={24} />
        </span>
        <span>{t('tabNewSale')}</span>
      </Link>
      <Link to="/sr/shops">
        <Icon name="customers" size={21} />
        <span>{t('tabShops')}</span>
      </Link>
      <Link to="/sr/collections">
        <Icon name="wallet" size={21} />
        <span>{t('tabCollect')}</span>
      </Link>
    </nav>
  );
}
