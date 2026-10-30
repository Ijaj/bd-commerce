import { StatusBadge, Toolbar } from '@bdc/ui';
import { Alert, Button, Loader, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import type { PoFilters } from './api';
import { dateLabel, PO_STATUS, STATUS_TABS } from './logic';
import classes from './PurchaseOrders.module.css';
import { type PoRow, type PoStatus, poListQuery, poQuery, poSuppliersQuery } from './queries';
import { ReceiveModal } from './ReceiveModal';

function ReceiveLoader({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery(poQuery(id));
  if (q.isError) return <Alert color="red">{(q.error as Error).message}</Alert>;
  if (!q.data) return <Loader size="sm" aria-label="Loading" />;
  return <ReceiveModal po={q.data} onClose={onClose} />;
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const canManage = useCan('suppliers.manage');
  const canReceive = useCan('purchase_orders.receive');
  const [tab, setTab] = useState<'all' | PoStatus>('all');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [receiving, setReceiving] = useState<string | null>(null);

  const filters: PoFilters = {
    page,
    pageSize,
    ...(tab !== 'all' ? { status: tab } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(debounced ? { q: debounced } : {}),
  };
  const list = useQuery(poListQuery(filters));
  const suppliers = useQuery(poSuppliersQuery);
  const counts = list.data?.counts;

  const columns: Column<PoRow>[] = [
    {
      key: 'po',
      header: 'PO',
      render: (r) => <b style={{ whiteSpace: 'nowrap' }}>{r.poNo}</b>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (r) => <div style={{ minWidth: 180 }}>{r.supplier.name}</div>,
    },
    {
      key: 'created',
      header: 'Created',
      render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{dateLabel(r.createdAt)}</span>,
    },
    {
      key: 'expected',
      header: 'Expected',
      render: (r) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {dateLabel(r.expectedAt)}
          {r.late && (
            <StatusBadge tone="danger" style={{ marginLeft: 6 }}>
              Late
            </StatusBadge>
          )}
        </span>
      ),
    },
    { key: 'lines', header: 'Lines', className: 'num', render: (r) => r.lineCount },
    {
      key: 'received',
      header: 'Received',
      className: 'num',
      render: (r) => (
        <>
          {r.qtyReceived} / {r.qtyOrdered}
          {r.qtyRejected > 0 && <span className="sub">{r.qtyRejected} rejected</span>}
        </>
      ),
    },
    {
      key: 'total',
      header: 'Total cost',
      className: 'num',
      render: (r) => formatPrice(r.subtotalP),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge tone={PO_STATUS[r.status].tone}>{PO_STATUS[r.status].label}</StatusBadge>
      ),
    },
    {
      key: 'act',
      header: '',
      className: 'act',
      render: (r) =>
        canReceive && (r.status === 'sent' || r.status === 'partially_received') ? (
          <Button
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              setReceiving(r.id);
            }}
          >
            Receive goods
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase orders"
        crumbs={['Suppliers & POs', 'Purchase orders']}
        actions={
          <>
            <Button component={Link} to="/suppliers" variant="default" size="xs">
              Suppliers
            </Button>
            {canManage && (
              <Button component={Link} to="/purchase-orders/new" size="xs">
                New purchase order
              </Button>
            )}
          </>
        }
      />
      <div className={classes.tabsWrap}>
        <div className="a-tabs" role="tablist" aria-label="PO status">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className="a-tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t === 'all' ? 'All' : PO_STATUS[t].label}
              {counts && <span className="a-count">{counts[t]}</span>}
            </button>
          ))}
        </div>
      </div>
      <Toolbar>
        <TextInput
          label="Search"
          placeholder="PO number or supplier"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
          w={240}
        />
        <Select
          label="Supplier"
          placeholder="All suppliers"
          clearable
          searchable
          w={240}
          value={supplierId}
          onChange={(v) => {
            setSupplierId(v);
            setPage(1);
          }}
          data={(suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
      </Toolbar>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage="No purchase orders"
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        onRowClick={(r) => navigate({ to: '/purchase-orders/$id', params: { id: r.id } })}
      />
      {receiving && <ReceiveLoader id={receiving} onClose={() => setReceiving(null)} />}
    </>
  );
}
