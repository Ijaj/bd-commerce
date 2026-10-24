import { Alert, Badge, Button, Card, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { AdjustModal } from './AdjustModal';
import { b2bApi } from './api';
import { ConfirmAction } from './components';
import { EditShopModal } from './EditShopModal';
import { LEDGER_TYPE_LABEL, ledgerState, rejectReason, STATE_COLOR } from './logic';
import { type LedgerRow, ledgerQuery, shopQuery, useInvalidateB2b } from './queries';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" component="div">
        {children}
      </Text>
    </div>
  );
}

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
          <Text size="sm">{r.memoNo ?? r.method ?? '-'}</Text>
          {r.note && (
            <Text size="xs" c="dimmed">
              {r.note}
            </Text>
          )}
          {rejectReason(r) && (
            <Text size="xs" c="red">
              Rejected: {rejectReason(r)}
            </Text>
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
          <Badge size="sm" variant="light" color={STATE_COLOR[s]}>
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
        <Text size="sm" c={r.amountP < 0 ? 'teal' : undefined}>
          {r.amountP < 0 ? `-${formatPrice(-r.amountP)}` : formatPrice(r.amountP)}
        </Text>
      ),
    },
  ];

  if (shopQ.isError) return <Alert color="red">{(shopQ.error as Error).message}</Alert>;
  if (!shop) return null;

  return (
    <div>
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" component={Link} to="/b2b/shops">
            Buyer shops
          </Text>
          <Group gap="xs">
            <Title order={2}>{shop.name}</Title>
            {shop.isNew && (
              <Badge variant="light" color="yellow">
                New
              </Badge>
            )}
            {shop.status === 'blocked' && (
              <Badge variant="light" color="red">
                Blocked
              </Badge>
            )}
          </Group>
        </div>
        {canManage && (
          <Group gap="xs">
            {shop.isNew && (
              <Button size="xs" variant="default" onClick={() => setClearing(true)}>
                Mark reviewed
              </Button>
            )}
            <Button size="xs" variant="default" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="xs" variant="default" onClick={() => setAdjusting(true)}>
              Adjust due
            </Button>
            <Button
              size="xs"
              variant="default"
              color={shop.status === 'blocked' ? undefined : 'red'}
              onClick={() => setBlocking(true)}
            >
              {shop.status === 'blocked' ? 'Unblock' : 'Block'}
            </Button>
          </Group>
        )}
      </Group>

      <Card withBorder mb="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Fact label="Current due">
            <Text fw={600} c={shop.dueBalanceP > 0 ? 'red' : undefined} component="span">
              {formatPrice(shop.dueBalanceP)}
            </Text>
          </Fact>
          <Fact label="Owner">{shop.ownerName ?? '-'}</Fact>
          <Fact label="Phone">{shop.phone}</Fact>
          <Fact label="Area">{shop.area ?? '-'}</Fact>
          <Fact label="Address">{shop.address}</Fact>
          <Fact label="Added by">{shop.createdBy.name}</Fact>
          <Fact label="Added">{formatDateTime(shop.createdAt)}</Fact>
          <Fact label="Notes">{shop.notes ?? '-'}</Fact>
        </SimpleGrid>
        {shop.status === 'blocked' && (
          <Text size="xs" c="dimmed" mt="sm">
            Blocked shops cannot receive new sales. Existing dues stay collectible.
          </Text>
        )}
      </Card>

      <Group justify="space-between" mb="xs">
        <Title order={4}>Ledger</Title>
        <Button
          size="xs"
          variant="subtle"
          onClick={() => navigate({ to: '/b2b/sales', search: { shopId: shop.id } })}
        >
          View sales
        </Button>
      </Group>
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
