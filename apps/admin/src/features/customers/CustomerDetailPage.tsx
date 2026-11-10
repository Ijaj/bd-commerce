import { Banner, EmptyState, KeyValue, SectionCard, StatTile, StatusBadge } from '@bdc/ui';
import { Alert, Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { BlockModal } from './BlockModal';
import classes from './customers.module.css';
import { averageOrderP, initials } from './logic';
import { NotesTab } from './NotesTab';
import { OrdersTab } from './OrdersTab';
import { customerQuery } from './queries';

type Tab = 'orders' | 'addresses' | 'notes';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'orders', label: 'Orders' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'notes', label: 'Notes' },
];

export function CustomerDetailPage({ id }: { id: string }) {
  const canManage = useCan('customers.manage');
  const q = useQuery(customerQuery(id));
  const [tab, setTab] = useState<Tab>('orders');
  const [blocking, setBlocking] = useState(false);
  const c = q.data;

  if (q.isError) return <Alert color="red">{(q.error as Error).message}</Alert>;
  if (!c) return null;

  return (
    <div>
      <PageHeader
        title={c.name}
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          <Link key="c" to="/customers">
            Customers
          </Link>,
          c.name,
        ]}
        description={
          c.blocked ? (
            <StatusBadge tone="danger">Blocked</StatusBadge>
          ) : (
            <StatusBadge tone="ok">Active</StatusBadge>
          )
        }
        actions={
          canManage ? (
            <Button
              variant={c.blocked ? 'default' : 'outline'}
              color={c.blocked ? undefined : 'red'}
              onClick={() => setBlocking(true)}
            >
              {c.blocked ? 'Unblock' : 'Block customer'}
            </Button>
          ) : undefined
        }
      />
      {c.blocked && (
        <Banner tone="danger">
          Blocked{c.blockedAt ? ` on ${formatDateTime(c.blockedAt)}` : ''}
          {c.blockedBy ? ` by ${c.blockedBy.name}` : ''}
          {c.blockedReason ? `: ${c.blockedReason}` : ''}. Cannot log in or order; guest orders from{' '}
          {c.phone ?? 'their phone'} are refused.
        </Banner>
      )}
      <div className={classes.profile}>
        <SectionCard title="Details">
          <div className={classes.who} style={{ marginBottom: 12 }}>
            <span className={`${classes.av} ${classes.avLg}`}>{initials(c.name)}</span>
            <h2 className={classes.name}>{c.name}</h2>
          </div>
          <KeyValue
            items={[
              [
                'Phone',
                <>
                  {c.phone ?? '-'}
                  {c.phone && (
                    <span className="sub">{c.phoneVerifiedAt ? 'Verified' : 'Not verified'}</span>
                  )}
                </>,
              ],
              [
                'Email',
                <>
                  {c.email ?? '-'}
                  {c.email && (
                    <span className="sub">{c.emailVerifiedAt ? 'Verified' : 'Not verified'}</span>
                  )}
                </>,
              ],
              ['Language', c.lang === 'bn' ? 'Bangla' : 'English'],
              ['Joined', formatDateTime(c.createdAt)],
              ['Last login', formatDateTime(c.lastLoginAt)],
              ['Cancelled orders', c.cancelledCount],
              ['Risky flag', c.isFlagged ? 'Flagged' : 'No'],
            ]}
          />
        </SectionCard>
        <div>
          <div className={classes.kpis}>
            <StatTile label="Orders" value={c.orderCount} />
            <StatTile label="Total spent" value={formatPrice(c.spentP)} />
            <StatTile
              label="Average order"
              value={c.orderCount > 0 ? formatPrice(averageOrderP(c.orderCount, c.spentP)) : '-'}
            />
            <StatTile
              label="Last order"
              value={c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '-'}
            />
          </div>
          <div className="a-card">
            <div className="a-tabs" role="tablist" aria-label="Customer sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className="a-tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.id === 'addresses' && <span className="a-count">{c.addresses.length}</span>}
                </button>
              ))}
            </div>
            {tab === 'orders' && <OrdersTab customerId={c.id} />}
            {tab === 'addresses' &&
              (c.addresses.length === 0 ? (
                <EmptyState icon="delivery" title="No saved addresses" />
              ) : (
                <div className={classes.addrList} style={{ padding: 12 }}>
                  {c.addresses.map((a) => (
                    <div key={a.id} className={classes.addr}>
                      <b>{a.label ?? a.name}</b>
                      {a.isDefault && (
                        <>
                          {' '}
                          <StatusBadge tone="info">Default</StatusBadge>
                        </>
                      )}
                      <div>{a.name}</div>
                      <div className={classes.muted}>{a.phone}</div>
                      <div>
                        {a.line}
                        {a.landmark ? ` (${a.landmark})` : ''}
                      </div>
                      <div className={classes.muted}>{a.placeText}</div>
                    </div>
                  ))}
                </div>
              ))}
            {tab === 'notes' && <NotesTab customerId={c.id} canAdd={canManage} />}
          </div>
        </div>
      </div>
      {blocking && <BlockModal customer={c} onClose={() => setBlocking(false)} />}
    </div>
  );
}
