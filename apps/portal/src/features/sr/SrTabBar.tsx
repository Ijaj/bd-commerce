import { Indicator } from '@mantine/core';
import { IconBuildingStore, IconCash, IconHome, IconPlus, IconReceipt } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { t } from '~/i18n';
import { srSalesQuery } from './queries';

export function SrTabBar() {
  const { data: sales } = useQuery(srSalesQuery);
  const pending = sales?.filter((s) => s.status === 'submitted').length ?? 0;
  // Link sets data-status="active" on the current tab; styles.css colours it.
  return (
    <nav className="portal-tabbar" aria-label="Main">
      <div style={{ display: 'flex', maxWidth: 640, margin: '0 auto' }}>
        <Link to="/sr" activeOptions={{ exact: true }} className="portal-tab">
          <IconHome size={22} />
          {t('tabHome')}
        </Link>
        <Link to="/sr/sales" className="portal-tab">
          <Indicator label={pending} disabled={pending === 0} size={16} color="red" offset={2}>
            <IconReceipt size={22} />
          </Indicator>
          {t('tabSales')}
        </Link>
        <Link to="/sr/new-sale" className="portal-tab">
          <span className="portal-tab-fab">
            <IconPlus size={24} />
          </span>
          {t('tabNewSale')}
        </Link>
        <Link to="/sr/shops" className="portal-tab">
          <IconBuildingStore size={22} />
          {t('tabShops')}
        </Link>
        <Link to="/sr/collections" className="portal-tab">
          <IconCash size={22} />
          {t('tabCollect')}
        </Link>
      </div>
    </nav>
  );
}
