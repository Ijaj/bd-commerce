import { Icon } from '@bdc/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { BackLink, PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { num, t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import { ledgerLabel, ledgerNewestFirst } from './logic';
import { srRecentHundredQuery, srShopQuery } from './queries';
import { SaleItem } from './SaleItem';
import { NewBadge } from './ShopsPage';

export function ShopDetailPage({ id }: { id: string }) {
  const shop = useQuery(srShopQuery(id));
  const sales = useQuery(srRecentHundredQuery);
  const [tab, setTab] = useState<'sales' | 'ledger'>('sales');
  return (
    <QueryBoundary query={shop}>
      {(s) => {
        const shopSales = sales.data?.items.filter((x) => x.shop.id === id) ?? [];
        const rows = ledgerNewestFirst(s.ledger);
        return (
          <>
            <BackLink to="/sr/shops">{t('backShops')}</BackLink>
            <PageTitle>
              {s.name}
              {s.isNew && <NewBadge />}
            </PageTitle>
            <div className="sr-card">
              <dl className="a-kv">
                <dt>{t('owner')}</dt>
                <dd>{s.ownerName ?? '-'}</dd>
                <dt>{t('phone')}</dt>
                <dd>
                  <a href={`tel:${s.phone}`}>{s.phone}</a>
                </dd>
                <dt>{t('address')}</dt>
                <dd>{[s.address, s.area].filter(Boolean).join(', ')}</dd>
              </dl>
              <div className="sr-grid2 sr-grid2-in">
                <div className="a-stat">
                  <div className="l">{t('currentDueLabel')}</div>
                  <div className={s.dueBalanceP > 0 ? 'v sr-due' : 'v'} data-testid="shop-due">
                    {formatPrice(s.dueBalanceP)}
                  </div>
                </div>
              </div>
            </div>
            <div className="sr-qa two">
              <Link to="/sr/new-sale" search={{ shop: s.id }}>
                <Icon name="plus" size={18} />
                {t('quickNewSale')}
              </Link>
              <Link to="/sr/collections" search={{ shop: s.id }}>
                <Icon name="wallet" size={18} />
                {t('quickCollect')}
              </Link>
            </div>
            <div className="sr-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'sales'}
                onClick={() => setTab('sales')}
              >
                {`${t('tabShopSales')} (${num(shopSales.length)})`}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'ledger'}
                onClick={() => setTab('ledger')}
              >
                {t('tabLedger')}
              </button>
            </div>
            {tab === 'sales' ? (
              shopSales.length === 0 ? (
                <div className="sr-empty">{t('noSales')}</div>
              ) : (
                shopSales.map((x) => <SaleItem key={x.id} sale={x} />)
              )
            ) : rows.length === 0 ? (
              <div className="sr-empty">{t('noLedger')}</div>
            ) : (
              <>
                <div className="sr-card sr-card-tbl">
                  <table className="sr-tbl">
                    <thead>
                      <tr>
                        <th>{t('ledgerDate')}</th>
                        <th>{t('ledgerEntry')}</th>
                        <th className="num">{t('ledgerAmount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className={r.confirmed ? undefined : 'mute'}>
                          <td>{formatDate(r.at)}</td>
                          <td>
                            {ledgerLabel(r.type)}
                            <div className="sr-muted">
                              {r.memoNo ?? r.note ?? ''}
                              {!r.confirmed && !r.rejected && ` ${t('awaitingConfirm')}`}
                            </div>
                            {r.rejected && (
                              <div className="sr-muted sr-due">
                                {t('collectionRejectedReason', { reason: r.rejectReason ?? '-' })}
                              </div>
                            )}
                          </td>
                          <td className={r.rejected ? 'num void' : 'num'}>
                            {r.confirmed
                              ? `${r.amountP > 0 ? '+' : '-'}${formatPrice(Math.abs(r.amountP))}`
                              : `(${formatPrice(Math.abs(r.amountP))})`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="a-hint">{t('ledgerPendingHint')}</p>
              </>
            )}
          </>
        );
      }}
    </QueryBoundary>
  );
}
