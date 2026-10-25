import { Icon } from '@bdc/ui';
import { Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { QueryBoundary } from '~/components/QueryBoundary';
import { num, t } from '~/i18n';
import { daysLeftInMonth, formatMonth, formatPrice } from '~/lib/format';
import { srMeQuery, srPendingQuery, srRecentSalesQuery } from './queries';
import { SaleItem } from './SaleItem';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/** Shows the install card only when the browser offers it (Chrome/Android). */
function InstallCard() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEv(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  if (!ev) return null;
  return (
    <div className="sr-install">
      <Icon name="device" size={22} />
      <span>
        <b>{t('installApp')}</b>
        <br />
        {t('installSub')}
      </span>
      <Button
        size="compact-sm"
        onClick={() => {
          void ev.prompt();
          setEv(null);
        }}
      >
        {t('install')}
      </Button>
    </div>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function HomePage() {
  const me = useQuery(srMeQuery);
  const sales = useQuery(srRecentSalesQuery);
  const pendingCount = useQuery(srPendingQuery).data ?? 0;
  return (
    <QueryBoundary query={me}>
      {(d) => {
        const m = d.month;
        const soldPct = pct(m.soldP, m.targetP);
        return (
          <>
            <InstallCard />
            <div className="sr-h">
              <h1>{t('hello', { name: d.staff.name.split(' ')[0] ?? '' })}</h1>
              <span className="sr-muted">{formatMonth()}</span>
            </div>

            <div className="sr-card">
              <h2 className="sr-h2">{t('monthTarget')}</h2>
              <div className="sr-row">
                <div className="sr-big" data-testid="sold">
                  {formatPrice(m.soldP)}
                </div>
                <div className="sr-muted">
                  {m.targetP > 0
                    ? t('ofTarget', { target: formatPrice(m.targetP) })
                    : t('noTarget')}
                </div>
              </div>
              <div className="sr-bar">
                <i style={{ width: `${Math.min(100, soldPct)}%` }} />
              </div>
              {m.targetP > 0 && (
                <div className="sr-row sr-muted">
                  <span>{t('percentSold', { pct: soldPct })}</span>
                  <span>
                    {t('toGo', { amount: formatPrice(Math.max(0, m.targetP - m.soldP)) })} ·{' '}
                    {t('daysLeft', { n: daysLeftInMonth() })}
                  </span>
                </div>
              )}
              <hr className="sr-sep" />
              <div className="sr-row">
                <div>
                  <div className="sr-muted">{t('collectedMonth')}</div>
                  <b className="sr-stat-v" data-testid="collected">
                    {formatPrice(m.collectedP)}
                  </b>
                </div>
                <div className="sr-right">
                  <div className="sr-muted">{t('collectionRate')}</div>
                  <b className="sr-stat-v">{num(pct(m.collectedP, m.soldP))}%</b>
                </div>
              </div>
              <div className="sr-bar acc">
                <i style={{ width: `${Math.min(100, pct(m.collectedP, m.soldP))}%` }} />
              </div>
            </div>

            <div className="sr-card">
              <h2 className="sr-h2">{t('commission')}</h2>
              <div className="sr-big sr-ok" data-testid="commission">
                {formatPrice(m.commissionP)}
              </div>
              <div className="sr-muted sr-mt">
                {t('commissionNote', { rate: d.profile.commissionBp / 100 })}
              </div>
            </div>

            <div className="sr-grid2">
              <Link to="/sr/shops" className="a-stat">
                <div className="l">{t('dueOutstanding')}</div>
                <div className="v" data-testid="due">
                  {formatPrice(m.dueOutstandingP)}
                </div>
              </Link>
              <Link to="/sr/sales" className="a-stat">
                <div className="l">{t('filterPending')}</div>
                <div className="v">{num(pendingCount)}</div>
              </Link>
            </div>

            <div className="sr-qa">
              <Link to="/sr/new-sale">
                <Icon name="plus" size={18} />
                {t('quickNewSale')}
              </Link>
              <Link to="/sr/collections">
                <Icon name="wallet" size={18} />
                {t('quickCollect')}
              </Link>
              <Link to="/sr/shops/new">
                <Icon name="customers" size={18} />
                {t('quickAddShop')}
              </Link>
            </div>

            <div className="sr-card sr-card-list">
              <div className="sr-row">
                <h2 className="sr-h2">{t('recentSales')}</h2>
                <Link to="/sr/sales" className="sr-link-sm">
                  {t('seeAll')}
                </Link>
              </div>
              <QueryBoundary query={sales}>
                {(list) =>
                  list.items.length === 0 ? (
                    <div className="sr-empty">{t('noSales')}</div>
                  ) : (
                    list.items.map((s) => <SaleItem key={s.id} sale={s} />)
                  )
                }
              </QueryBoundary>
            </div>
          </>
        );
      }}
    </QueryBoundary>
  );
}
