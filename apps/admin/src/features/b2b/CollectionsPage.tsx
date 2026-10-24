import { Alert, Badge, Button, Group, SegmentedControl, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { b2bApi, type CollectionStatus } from './api';
import { ConfirmAction, ReasonModal } from './components';
import { ledgerState, rejectReason } from './logic';
import { collectionsQuery, type LedgerRow, useInvalidateB2b } from './queries';

export function CollectionsPage() {
  const canApprove = useCan('sr.approve');
  const invalidate = useInvalidateB2b();
  const [status, setStatus] = useState<CollectionStatus>('pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const list = useQuery(collectionsQuery(status, page, pageSize));
  const [confirming, setConfirming] = useState<LedgerRow | null>(null);
  const [rejecting, setRejecting] = useState<LedgerRow | null>(null);

  const columns: Column<LedgerRow>[] = [
    { key: 'at', header: 'Date', render: (r) => formatDateTime(r.at) },
    { key: 'sr', header: 'SR', render: (r) => r.recordedBy.name },
    {
      key: 'shop',
      header: 'Shop',
      render: (r) => (
        <Link to="/b2b/shops/$id" params={{ id: r.b2bShopId }}>
          <Text size="sm" component="span">
            {r.shopName}
          </Text>
        </Link>
      ),
    },
    { key: 'method', header: 'Method', render: (r) => r.method ?? '-' },
    {
      key: 'note',
      header: 'Note',
      render: (r) => (
        <div>
          <Text size="sm">{r.note ?? '-'}</Text>
          {rejectReason(r) && (
            <Text size="xs" c="red">
              Rejected: {rejectReason(r)}
            </Text>
          )}
        </div>
      ),
    },
    // Collections are stored negative (they reduce the due); the queue shows what was collected.
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => formatPrice(Math.abs(r.amountP)),
    },
    {
      key: 'state',
      header: 'State',
      render: (r) => {
        const s = ledgerState(r);
        const color = s === 'confirmed' ? 'teal' : s === 'rejected' ? 'red' : 'yellow';
        return (
          <Badge size="sm" variant="light" color={color}>
            {s[0]?.toUpperCase() + s.slice(1)}
          </Badge>
        );
      },
    },
  ];
  if (canApprove) {
    columns.push({
      key: 'actions',
      header: '',
      render: (r) =>
        ledgerState(r) === 'pending' ? (
          <Group gap={4} wrap="nowrap" justify="flex-end">
            <Button size="compact-xs" onClick={() => setConfirming(r)}>
              Confirm
            </Button>
            <Button size="compact-xs" variant="default" color="red" onClick={() => setRejecting(r)}>
              Reject
            </Button>
          </Group>
        ) : null,
    });
  }

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Cash an SR collected from shops. A collection only reduces the shop's due once you confirm it."
      />
      <SegmentedControl
        mb="sm"
        aria-label="Collection state"
        value={status}
        onChange={(v) => {
          setStatus(v as CollectionStatus);
          setPage(1);
        }}
        data={[
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ]}
      />
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage={
          status === 'pending' ? 'Nothing waiting for confirmation.' : 'No collections.'
        }
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        pageSizeOptions={[25, 50, 100]}
      />

      <ConfirmAction
        opened={!!confirming}
        onClose={() => setConfirming(null)}
        title="Confirm collection"
        confirmLabel="Confirm"
        onConfirm={async () => {
          if (!confirming) return;
          await b2bApi.confirmCollection(confirming.id);
          notifyOk('Collection confirmed');
          invalidate();
        }}
      >
        Confirm {confirming && formatPrice(Math.abs(confirming.amountP))} from{' '}
        <b>{confirming?.shopName}</b> collected by {confirming?.recordedBy.name}? It reduces the
        shop's due.
      </ConfirmAction>

      <ReasonModal
        opened={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject collection"
        confirmLabel="Reject"
        onSubmit={async (reason) => {
          if (!rejecting) return;
          await b2bApi.rejectCollection(rejecting.id, reason);
          notifyOk('Collection rejected');
          invalidate();
        }}
      >
        Reject {rejecting && formatPrice(Math.abs(rejecting.amountP))} from{' '}
        <b>{rejecting?.shopName}</b>? It will never count toward the due or commission.
      </ReasonModal>
    </div>
  );
}
