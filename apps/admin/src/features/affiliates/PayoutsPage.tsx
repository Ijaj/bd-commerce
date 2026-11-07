import { StatTile } from '@bdc/ui';
import { Alert, Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import classes from './affiliates.module.css';
import { CodeChip } from './components';
import { detailLines, methodLabel } from './logic';
import { MarkPaidModal } from './MarkPaidModal';
import { PayoutHistory } from './PayoutHistory';
import { type DueRow, dueQuery } from './queries';

type Tab = 'due' | 'history';

export function PayoutsPage() {
  const allowed = useCan('affiliate_payouts.manage');
  const [tab, setTab] = useState<Tab>('due');
  const [paying, setPaying] = useState<DueRow | null>(null);
  const due = useQuery({ ...dueQuery, enabled: allowed });

  if (!allowed) {
    return <Alert color="yellow">You do not have permission to manage affiliate payouts.</Alert>;
  }

  const rows = due.data?.items ?? [];
  const total = rows.reduce((s, r) => s + r.balanceP, 0);

  const columns: Column<DueRow>[] = [
    {
      key: 'aff',
      header: 'Affiliate',
      render: (r) => (
        <Link to="/affiliates/$id" params={{ id: r.affiliateId }}>
          <b>{r.displayName}</b> <CodeChip code={r.code} />
        </Link>
      ),
    },
    { key: 'n', header: 'Commissions', className: 'num', render: (r) => r.commissionCount },
    {
      key: 'bal',
      header: 'Balance due',
      className: 'num',
      render: (r) => <b>{formatPrice(r.balanceP)}</b>,
    },
    {
      key: 'to',
      header: 'Pay to',
      render: (r) =>
        r.hasPayoutDetails ? (
          <span>
            {methodLabel(r.payoutMethod)}
            <span className="sub">{detailLines(r.payoutDetails).join(' · ')}</span>
          </span>
        ) : (
          <span className={classes.muted}>No details saved</span>
        ),
    },
    {
      key: 'act',
      header: '',
      className: 'act',
      render: (r) => (
        <Button size="xs" onClick={() => setPaying(r)}>
          Mark paid
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Affiliate payouts"
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          <Link key="a" to="/affiliates">
            Affiliates
          </Link>,
          'Payouts',
        ]}
        description="Pay approved commission by bKash or bank, then record the reference here."
      />
      <div className={classes.kpis}>
        <StatTile label="Total due" value={formatPrice(total)} />
        <StatTile label="Affiliates to pay" value={rows.length} />
      </div>
      <div className={`a-tabs ${classes.tabs}`} role="tablist" aria-label="Payout sections">
        {(['due', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className="a-tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'due' ? 'Due' : 'History'}
          </button>
        ))}
      </div>
      {tab === 'due' && (
        <>
          {due.isError && <Alert color="red">{(due.error as Error).message}</Alert>}
          <DataTable
            columns={columns}
            rows={due.data?.items}
            rowKey={(r) => r.affiliateId}
            loading={due.isLoading}
            emptyMessage={
              <span className={classes.muted}>Nobody has reached the minimum payout yet.</span>
            }
          />
        </>
      )}
      {tab === 'history' && <PayoutHistory />}
      {paying && <MarkPaidModal due={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
