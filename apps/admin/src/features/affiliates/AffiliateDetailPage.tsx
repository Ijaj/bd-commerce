import { KeyValue, SectionCard, StatTile } from '@bdc/ui';
import { Alert, Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import classes from './affiliates.module.css';
import { CommissionsTab } from './CommissionsTab';
import { AffiliateStatusBadge, CodeChip } from './components';
import { EditAffiliateModal } from './EditAffiliateModal';
import { detailLines, formatBp, methodLabel } from './logic';
import { PayoutHistory } from './PayoutHistory';
import { affiliateQuery } from './queries';

type Tab = 'commissions' | 'payouts';

export function AffiliateDetailPage({ id }: { id: string }) {
  const canManage = useCan('affiliates.manage');
  const canPay = useCan('affiliate_payouts.manage');
  const q = useQuery(affiliateQuery(id));
  const [tab, setTab] = useState<Tab>('commissions');
  const [editing, setEditing] = useState(false);
  const a = q.data;

  if (q.isError) return <Alert color="red">{(q.error as Error).message}</Alert>;
  if (!a) return null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'commissions', label: 'Commissions' },
    ...(canPay ? [{ id: 'payouts' as const, label: 'Payouts' }] : []),
  ];
  const lines = detailLines(a.payoutDetails);

  return (
    <div>
      <PageHeader
        title={a.displayName}
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          <Link key="a" to="/affiliates">
            Affiliates
          </Link>,
          a.displayName,
        ]}
        description={<AffiliateStatusBadge status={a.status} />}
        actions={
          canManage ? (
            <Button variant="default" onClick={() => setEditing(true)}>
              Edit rate / status
            </Button>
          ) : undefined
        }
      />
      {a.status === 'suspended' && (
        <Alert color="yellow" variant="light" mb="sm">
          Suspended{a.suspendedAt ? ` on ${formatDateTime(a.suspendedAt)}` : ''}
          {a.suspendedReason ? `: ${a.suspendedReason}` : ''}. No new orders are attributed;
          existing commissions still run.
        </Alert>
      )}
      <div className={classes.kpis}>
        <StatTile label="Clicks (30 days)" value={a.clicks30} />
        <StatTile label="Orders (30 days)" value={a.orders30} />
        <StatTile label="Pending" value={formatPrice(a.pendingP)} />
        <StatTile label="Balance (approved)" value={formatPrice(a.balanceP)} />
        <StatTile label="Paid" value={formatPrice(a.paidP)} />
      </div>
      <SectionCard title="Details" className="a-gap">
        <KeyValue
          items={[
            ['Code', <CodeChip key="c" code={a.code} />],
            [
              'Customer',
              <>
                {a.customer.name}
                <span className="sub">
                  {[a.customer.phone, a.customer.email].filter(Boolean).join(' · ')}
                </span>
              </>,
            ],
            [
              'Commission rate',
              <>
                {formatBp(a.commissionBp)}
                {a.rateOverridden ? ' (custom)' : ' (programme default)'}
              </>,
            ],
            ['Website', a.website ?? '-'],
            ['Joined', formatDateTime(a.createdAt)],
            ['Payout method', methodLabel(a.payoutMethod)],
            [
              'Payout details',
              lines.length > 0 ? (
                <ul key="d" className={classes.details} data-testid="payout-details">
                  {lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                'Not set'
              ),
            ],
          ]}
        />
        {!canPay && lines.length > 0 && (
          <p className={classes.muted} style={{ fontSize: 12 }}>
            Full payout details need the payout permission.
          </p>
        )}
      </SectionCard>
      <div className={`a-tabs ${classes.tabs}`} role="tablist" aria-label="Affiliate sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="a-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'commissions' && <CommissionsTab affiliateId={a.id} />}
      {tab === 'payouts' && canPay && <PayoutHistory affiliateId={a.id} />}
      {editing && <EditAffiliateModal affiliate={a} onClose={() => setEditing(false)} />}
    </div>
  );
}
