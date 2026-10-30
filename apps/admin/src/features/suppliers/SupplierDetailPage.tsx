import { StatTile, StatusBadge } from '@bdc/ui';
import { Alert, Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { ConfirmAction } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { suppliersApi } from './api';
import { Balance } from './components';
import { DetailsTab } from './DetailsTab';
import { LedgerTab } from './LedgerTab';
import { LinksTab } from './LinksTab';
import { supplierQuery, useInvalidateSuppliers } from './queries';
import classes from './suppliers.module.css';

type Tab = 'details' | 'products' | 'ledger';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'products', label: 'Products' },
  { id: 'ledger', label: 'Ledger' },
];

export function SupplierDetailPage({ id }: { id: string }) {
  const canManage = useCan('suppliers.manage');
  const canPay = useCan('supplier_payments.manage');
  const invalidate = useInvalidateSuppliers();
  const q = useQuery(supplierQuery(id));
  const [tab, setTab] = useState<Tab>('details');
  const [toggling, setToggling] = useState(false);
  const s = q.data;

  if (q.isError) return <Alert color="red">{(q.error as Error).message}</Alert>;
  if (!s) return null;

  return (
    <div>
      <PageHeader
        title={s.name}
        crumbs={[
          <Link key="d" to="/">
            Dashboard
          </Link>,
          <Link key="s" to="/suppliers">
            Suppliers & POs
          </Link>,
          s.name,
        ]}
        description={
          <StatusBadge tone={s.isActive ? 'ok' : 'muted'}>
            {s.isActive ? 'Active' : 'Paused'}
          </StatusBadge>
        }
        actions={
          <>
            {canManage && (
              <Button
                variant="default"
                color={s.isActive ? 'red' : undefined}
                onClick={() => setToggling(true)}
              >
                {s.isActive ? 'Pause supplier' : 'Reactivate'}
              </Button>
            )}
            {canManage && s.isActive && (
              <Link
                to="/purchase-orders/new"
                search={{ supplierId: s.id }}
                className="a-btn primary"
              >
                New purchase order
              </Link>
            )}
          </>
        }
      />
      <div className={classes.kpis}>
        <StatTile label="Balance owed" value={<Balance balanceP={s.balanceP} />} />
        <StatTile label="Open POs" value={s.openPoCount} />
        <StatTile label="Linked products" value={s.productCount} />
      </div>
      <div className={`a-tabs ${classes.tabs}`} role="tablist" aria-label="Supplier sections">
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
          </button>
        ))}
      </div>
      {tab === 'details' && <DetailsTab supplier={s} canManage={canManage} />}
      {tab === 'products' && <LinksTab supplierId={s.id} canManage={canManage} />}
      {tab === 'ledger' && <LedgerTab supplierId={s.id} supplierName={s.name} canPay={canPay} />}
      <ConfirmAction
        opened={toggling}
        onClose={() => setToggling(false)}
        title={s.isActive ? 'Pause supplier' : 'Reactivate supplier'}
        confirmLabel={s.isActive ? 'Pause' : 'Reactivate'}
        color={s.isActive ? 'red' : undefined}
        onConfirm={async () => {
          await suppliersApi.update(s.id, { isActive: !s.isActive });
          notifyOk(s.isActive ? 'Supplier paused' : 'Supplier reactivated');
          invalidate();
        }}
      >
        {s.isActive
          ? `Pause ${s.name}? No new purchase orders can be raised for it. The ledger and open POs stay.`
          : `Let purchase orders be raised for ${s.name} again?`}
      </ConfirmAction>
    </div>
  );
}
