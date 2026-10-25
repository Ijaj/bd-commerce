import { EmptyState, SectionCard, StatTile } from '@bdc/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '~/components/PageHeader';
import { useCallQueueCount } from '~/features/orders/queries';
import { meQuery } from '~/lib/auth';
import classes from './Dashboard.module.css';

// No reports API yet (P1): revenue/orders/AOV/conversion, the sales chart, status donut, top products,
// traffic and alerts from plan/mockups/admin/index.html are shown as placeholders, not faked.
const KPIS = [
  { label: 'Revenue', icon: 'reports' },
  { label: 'Orders', icon: 'orders' },
  { label: 'Avg order value', icon: 'coupons' },
  { label: 'Conversion rate', icon: 'customers' },
] as const;

/** Dashboard (plan/mockups/admin/index.html), limited to data the API has. */
export function Dashboard() {
  const { data: me } = useQuery(meQuery);
  const callQueueCount = useCallQueueCount();
  const canCall = me?.permissions.includes('orders.call') ?? false;
  return (
    <>
      <PageHeader
        title="Dashboard"
        crumbs={['Admin', 'Dashboard']}
        description={`Welcome back, ${me?.name ?? ''}.`}
      />
      <div className={`a-grid-4 ${classes.kpis}`}>
        {KPIS.map((k) => (
          <StatTile
            key={k.label}
            label={k.label}
            value="—"
            icon={k.icon}
            delta="Arrives with reports"
            deltaDir="neutral"
          />
        ))}
      </div>
      {canCall && (
        <div className={classes.ops}>
          <Link to="/call-queue" className={classes.opLink}>
            <StatTile
              label="Call queue"
              value={callQueueCount ?? '—'}
              icon="phone"
              alert={Boolean(callQueueCount)}
              delta="Orders waiting for a call"
              deltaDir="neutral"
            />
          </Link>
        </div>
      )}
      <div className={classes.main}>
        <SectionCard
          title="Sales"
          actions={<span className="a-sm a-muted">Net revenue incl. VAT</span>}
        >
          <EmptyState icon="reports" title="No sales chart yet">
            Sales trends, orders by status, top products and traffic sources arrive with the reports
            step.
          </EmptyState>
        </SectionCard>
        <SectionCard title="Needs attention">
          <EmptyState icon="check" title="Nothing flagged">
            Alerts (held orders, refunds awaiting approval, low stock) arrive with reports.
          </EmptyState>
        </SectionCard>
      </div>
    </>
  );
}
