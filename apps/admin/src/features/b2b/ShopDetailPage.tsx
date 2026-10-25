import { KeyValue, SectionCard } from '@bdc/ui';
import { Alert, Badge, Button, Group } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { AdjustModal } from './AdjustModal';
import { b2bApi } from './api';
import classes from './b2b.module.css';
import { ConfirmAction } from './components';
import { EditShopModal } from './EditShopModal';
import { LEDGER_TYPE_LABEL, ledgerState, rejectReason, STATE_COLOR } from './logic';
import { type LedgerRow, ledgerQuery, shopQuery, useInvalidateB2b } from './queries';

export function ShopDetailPage({ id }: { id: string }) {
  const canManage = useCan('b2b.manage');
  const navigate = useNavigate();
  const invalidate = useInvalidateB2b();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const shopQ = useQuery(shopQuery(id));
  const ledgerQ = useQuery(ledgerQuery(id, page, pageSize));
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const shop = shopQ.data;

  const columns: Column<LedgerRow>[] = [
    { key: 'at', header: 'Date', render: (r) => formatDateTime(r.at) },
    { key: 'type', header: 'Entry', render: (r) => LEDGER_TYPE_LABEL[r.type] ?? r.type },
    {
      key: 'ref',
      header: 'Reference',
      render: (r) => (
        <div>
          <span className={classes.mono}>{r.memoNo ?? r.method ?? '-'}</span>
          {r.note && <span className="sub">{r.note}</span>}
          {rejectReason(r) && (
            <span className={`sub ${classes.due}`}>Rejected: {rejectReason(r)}</span>
          )}
        </div>
      ),
    },
    { key: 'by', header: 'Recorded by', render: (r) => r.recordedBy.name },
    {
      key: 'state',
      header: 'State',
      render: (r) => {
        const s = ledgerState(r);
        return s === 'posted' ? null : (
          <Badge size="sm" color={STATE_COLOR[s]}>
            {s[0]?.toUpperCase() + s.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <span className={r.amountP < 0 ? classes.ok : undefined}>
          {r.amountP < 0 ? `-${formatPrice(-r.amountP)}` : formatPrice(r.amountP)}
        </span>
      ),
    },
  ];

  if (shopQ.isError) return <Alert color="red">{(shopQ.error as Error).message}</Alert>;
  if (!shop) return null;

  return (
    <div>
      <PageHeader
        title={shop.name}
        crumbs={[
          'People & partners',
          <Link key="shops" to="/b2b/shops">
            Buyer shops
          </Link>,
          shop.name,
        ]}
        description={
          (shop.isNew || shop.status === 'blocked') && (
            <Group gap={6}>
              {shop.isNew && <Badge color="blue">New</Badge>}
              {shop.status === 'blocked' && <Badge color="red">Blocked</Badge>}
            </Group>
          )
        }
        actions={
          canManage && (
            <Group gap="xs">
              {shop.isNew && (
                <Button size="compact-sm" onClick={() => setClearing(true)}>
                  Mark reviewed
                </Button>
              )}
              <Button size="compact-sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="compact-sm" onClick={() => setAdjusting(true)}>
                Adjust due
              </Button>
              <Button
                size="compact-sm"
                color={shop.status === 'blocked' ? undefined : 'red'}
                onClick={() => setBlocking(true)}
              >
                {shop.status === 'blocked' ? 'Unblock' : 'Block'}
              </Button>
            </Group>
          )
        }
      />

      <SectionCard title="Shop details">
        <KeyValue
          items={[
            [
              'Current due',
              <span key="due" className={shop.dueBalanceP > 0 ? classes.due : undefined}>
                {formatPrice(shop.dueBalanceP)}
              </span>,
            ],
            ['Owner', shop.ownerName ?? '-'],
            ['Phone', shop.phone],
            ['Area', shop.area ?? '-'],
            ['Address', shop.address],
            ['Added by', shop.createdBy.name],
            ['Added', formatDateTime(shop.createdAt)],
            ['Notes', shop.notes ?? '-'],
          ]}
        />
        {shop.status === 'blocked' && (
          <p className={classes.muted}>
            Blocked shops cannot receive new sales. Existing dues stay collectible.
          </p>
        )}
      </SectionCard>

      <SectionCard
        className="a-gap"
        title="Ledger"
        flush
        actions={
          <Button
            size="compact-sm"
            variant="subtle"
            onClick={() => navigate({ to: '/b2b/sales', search: { shopId: shop.id } })}
          >
            View sales
          </Button>
        }
      >
        <DataTable
          columns={columns}
          rows={ledgerQ.data?.items}
          rowKey={(r) => r.id}
          loading={ledgerQ.isLoading}
          emptyMessage="No ledger entries yet."
          page={page}
          pageSize={pageSize}
          total={ledgerQ.data?.total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          pageSizeOptions={[25, 50, 100]}
        />
      </SectionCard>

      {editing && <EditShopModal shop={shop} onClose={() => setEditing(false)} />}
      {adjusting && <AdjustModal shop={shop} onClose={() => setAdjusting(false)} />}

      <ConfirmAction
        opened={blocking}
        onClose={() => setBlocking(false)}
        title={shop.status === 'blocked' ? 'Unblock shop' : 'Block shop'}
        confirmLabel={shop.status === 'blocked' ? 'Unblock' : 'Block'}
        color={shop.status === 'blocked' ? undefined : 'red'}
        onConfirm={async () => {
          await b2bApi.updateShop(shop.id, {
            status: shop.status === 'blocked' ? 'active' : 'blocked',
          });
          notifyOk(shop.status === 'blocked' ? 'Shop unblocked' : 'Shop blocked');
          invalidate();
        }}
      >
        {shop.status === 'blocked'
          ? `Let sales reps sell to ${shop.name} again?`
          : `Stop new sales to ${shop.name}? Existing dues stay collectible.`}
      </ConfirmAction>

      <ConfirmAction
        opened={clearing}
        onClose={() => setClearing(false)}
        title="Mark reviewed"
        confirmLabel="Mark reviewed"
        onConfirm={async () => {
          await b2bApi.updateShop(shop.id, { isNew: false });
          notifyOk('New flag cleared');
          invalidate();
        }}
      >
        Clear the "new" flag on {shop.name}? It means you checked the shop details.
      </ConfirmAction>
    </div>
  );
}
