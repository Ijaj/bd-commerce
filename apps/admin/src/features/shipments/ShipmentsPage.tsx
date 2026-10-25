import { Banner, Toolbar } from '@bdc/ui';
import { Button, Select, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import classes from '~/features/orders/Orders.module.css';
import { formatDateTime, formatPrice } from '~/lib/format';
import { COURIER_OPTIONS, MAX_LABELS, type Shipment, STATUS_LABEL } from './logic';
import { shipmentsQuery } from './queries';
import { ShipmentActions } from './ShipmentActions';
import { StatusBadge } from './StatusBadge';

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

export function ShipmentsPage() {
  const [status, setStatus] = useState<Shipment['status'] | null>('ready');
  const [courier, setCourier] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = useQuery(
    shipmentsQuery({
      status: status ?? undefined,
      courier: courier ?? undefined,
      q: q.trim() || undefined,
      page,
      pageSize,
    }),
  );

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const rows = list.data?.items ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const tooMany = picked.size > MAX_LABELS;

  const columns: Column<Shipment>[] = [
    {
      key: 'pick',
      header: (
        <input
          type="checkbox"
          aria-label="Select all on this page"
          checked={allOnPage}
          onChange={() =>
            setPicked((cur) => {
              const next = new Set(cur);
              for (const r of rows) {
                if (allOnPage) next.delete(r.id);
                else next.add(r.id);
              }
              return next;
            })
          }
        />
      ),
      width: 32,
      render: (r) => (
        <input
          type="checkbox"
          aria-label={`Select ${r.shipmentNo}`}
          checked={picked.has(r.id)}
          onChange={() => toggle(r.id)}
        />
      ),
    },
    { key: 'no', header: 'Shipment', render: (r) => <b>{r.shipmentNo}</b> },
    {
      key: 'order',
      header: 'Order',
      render: (r) => (
        <Link to="/orders/$id" params={{ id: r.orderId }} className={classes.orderNo}>
          {r.orderNo}
        </Link>
      ),
    },
    {
      key: 'to',
      header: 'Ship to',
      render: (r) => (
        <div>
          <b>{r.recipient.name}</b>
          <span className={classes.sub}>
            {r.recipient.phone} · {r.recipient.placeText}
          </span>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      render: (r) => r.items.reduce((n, i) => n + i.qty, 0),
    },
    { key: 'cod', header: 'COD', align: 'right', render: (r) => formatPrice(r.codAmountP) },
    {
      key: 'courier',
      header: 'Courier',
      render: (r) => (
        <div>
          {r.courier?.name ?? <span className={classes.muted}>Not booked</span>}
          {r.consignmentId && <span className={classes.sub}>{r.consignmentId}</span>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created', header: 'Created', render: (r) => formatDateTime(r.createdAt) },
    { key: 'actions', header: '', render: (r) => <ShipmentActions shipment={r} /> },
  ];

  const ids = [...picked].slice(0, MAX_LABELS);

  return (
    <>
      <PageHeader
        title="Shipments"
        crumbs={['Sales', 'Shipments']}
        description="Book couriers, hand parcels over and print labels."
        actions={
          <Button
            component="a"
            href={`/print/labels?ids=${ids.join(',')}`}
            target="_blank"
            rel="noopener"
            disabled={picked.size === 0}
          >
            Print labels ({picked.size})
          </Button>
        }
      />
      <Toolbar>
        <TextInput
          className="grow"
          aria-label="Search"
          placeholder="Search shipment no, order no, phone, tracking"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
          miw={200}
        />
        <Select
          aria-label="Status"
          placeholder="Status: all"
          data={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v as Shipment['status'] | null);
            setPage(1);
          }}
          clearable
          w={200}
        />
        <Select
          aria-label="Courier"
          placeholder="Courier: all"
          data={COURIER_OPTIONS}
          value={courier}
          onChange={(v) => {
            setCourier(v);
            setPage(1);
          }}
          clearable
          w={180}
        />
        {picked.size > 0 && (
          <Button variant="subtle" size="compact-sm" onClick={() => setPicked(new Set())}>
            Clear selection
          </Button>
        )}
      </Toolbar>
      {tooMany && (
        <div className={classes.errorCard}>
          <Banner tone="warn">
            Labels print {MAX_LABELS} at a time. Only the first {MAX_LABELS} selected will be
            opened; print the rest in another batch.
          </Banner>
        </div>
      )}
      {list.isError && (
        <div className={classes.errorCard}>
          <Banner tone="danger">{list.error.message}</Banner>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage="No shipments match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />
    </>
  );
}
