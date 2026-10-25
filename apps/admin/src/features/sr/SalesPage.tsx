import { Toolbar } from '@bdc/ui';
import { Alert, Badge, Select } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { shopsQuery } from '~/features/b2b/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import type { SaleFilters } from './api';
import { dateToMonth, monthToDate, type SaleStatusX, STATUS_COLOR, STATUS_LABEL } from './logic';
import { type Sale, salesQuery, srListQuery } from './queries';
import { SaleDrawer } from './SaleDrawer';
import classes from './sr.module.css';

const ANY = 'any';

export interface SalesSearch {
  shopId?: string;
  /** Not `status`: the products route already uses that key with a narrower type. */
  saleStatus?: string;
  srId?: string;
  /** YYYY-MM, by approval date. */
  month?: string;
  open?: string;
}

export function validateSalesSearch(s: Record<string, unknown>): SalesSearch {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  return {
    shopId: str(s.shopId),
    saleStatus: str(s.saleStatus),
    srId: str(s.srId),
    month: typeof s.month === 'string' && /^\d{4}-\d{2}$/.test(s.month) ? s.month : undefined,
    open: str(s.open),
  };
}

export function SalesPage({ search }: { search: SalesSearch }) {
  const navigate = useNavigate({ from: '/b2b/sales' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [shopText, setShopText] = useState('');
  const [debouncedShop] = useDebouncedValue(shopText.trim(), 250);
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);

  const status = search.saleStatus ?? ANY;
  const srId = search.srId ?? ANY;
  const shopId = search.shopId ?? ANY;
  const set = (patch: SalesSearch) => {
    setPage(1);
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const filters: SaleFilters = {
    page,
    pageSize,
    ...(status !== ANY ? { status: status as NonNullable<SaleFilters['status']> } : {}),
    ...(srId !== ANY ? { srId } : {}),
    ...(shopId !== ANY ? { shopId } : {}),
    ...(search.month ? { month: search.month } : {}),
  };
  const list = useQuery(salesQuery(filters));
  const srs = useQuery(srListQuery);
  const shops = useQuery(
    shopsQuery({ page: 1, pageSize: 20, ...(debouncedShop ? { q: debouncedShop } : {}) }),
  );

  const shopOptions = (shops.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }));
  if (shopId !== ANY && !shopOptions.some((o) => o.value === shopId)) {
    const name = list.data?.items.find((s) => s.shop.id === shopId)?.shop.name ?? 'Selected shop';
    shopOptions.unshift({ value: shopId, label: name });
  }

  const columns: Column<Sale>[] = [
    { key: 'date', header: 'Submitted', render: (s) => formatDateTime(s.submittedAt) },
    { key: 'memo', header: 'Memo', render: (s) => s.memoNo },
    { key: 'sr', header: 'SR', render: (s) => s.sr.name },
    { key: 'shop', header: 'Shop', render: (s) => s.shop.name },
    { key: 'items', header: 'Items', align: 'right', render: (s) => s.itemCount },
    { key: 'total', header: 'Total', align: 'right', render: (s) => formatPrice(s.totalP) },
    { key: 'paid', header: 'Paid', align: 'right', render: (s) => formatPrice(s.paidAtSaleP) },
    {
      key: 'due',
      header: 'Due',
      align: 'right',
      render: (s) => (
        <span className={s.dueP > 0 ? classes.due : undefined}>{formatPrice(s.dueP)}</span>
      ),
    },
    {
      key: 'delivery',
      header: 'Delivery',
      render: (s) => (s.deliveryBy === 'sr' ? 'SR' : 'Staff'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const st = s.status as SaleStatusX;
        return (
          <Badge size="sm" color={STATUS_COLOR[st]}>
            {STATUS_LABEL[st]}
          </Badge>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="SR sales"
        crumbs={['People & partners', 'SR approvals']}
        description="Sales entered by reps. Approve to post the due and the memo; mark delivered to deduct stock."
      />
      <Toolbar>
        <Select
          label="Status"
          w={180}
          allowDeselect={false}
          value={status}
          onChange={(v) => set({ saleStatus: v && v !== ANY ? v : undefined })}
          data={[
            { value: ANY, label: 'All' },
            ...(
              ['submitted', 'approved', 'delivered', 'rejected', 'cancelled', 'reversed'] as const
            ).map((v) => ({ value: v, label: STATUS_LABEL[v] })),
          ]}
        />
        <Select
          label="Sales rep"
          w={180}
          allowDeselect={false}
          value={srId}
          onChange={(v) => set({ srId: v && v !== ANY ? v : undefined })}
          data={[
            { value: ANY, label: 'All' },
            ...(srs.data ?? []).map((p) => ({ value: p.staffId, label: p.name })),
          ]}
        />
        <MonthPickerInput
          label="Month"
          w={160}
          clearable
          placeholder="Any month"
          value={search.month ? monthToDate(search.month) : null}
          onChange={(d) => set({ month: dateToMonth(d) ?? undefined })}
        />
        <Select
          label="Shop"
          w={220}
          placeholder="All shops"
          searchable
          clearable
          data={shopOptions}
          value={shopId === ANY ? null : shopId}
          searchValue={shopText}
          onSearchChange={setShopText}
          onChange={(v) => set({ shopId: v ?? undefined })}
          filter={({ options }) => options}
        />
      </Toolbar>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(s) => s.id}
        loading={list.isLoading}
        emptyMessage="No sales match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(s) => setOpenId(s.id)}
      />
      <SaleDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
