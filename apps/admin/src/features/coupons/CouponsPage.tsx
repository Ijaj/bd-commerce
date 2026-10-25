import { Badge, Button, Group, Select, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import {
  type CouponKind,
  type CouponPhase,
  type CouponRow,
  type CouponStatus,
  type CouponType,
  KIND_LABEL,
  PHASE_COLOR,
  PHASE_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  valueSummary,
  windowSummary,
} from './logic';
import { couponsQuery } from './queries';

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export function CouponsPage() {
  const navigate = useNavigate();
  const canManage = useCan('coupons.manage');
  const [kind, setKind] = useState<CouponKind | null>(null);
  const [status, setStatus] = useState<CouponStatus | null>(null);
  const [type, setType] = useState<CouponType | null>(null);
  const [phase, setPhase] = useState<CouponPhase | null>(null);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const list = useQuery(
    couponsQuery({
      kind: kind ?? undefined,
      status: status ?? undefined,
      type: type ?? undefined,
      phase: phase ?? undefined,
      q: q || undefined,
      page,
      limit,
    }),
  );

  // Any filter change goes back to page 1.
  const filter =
    <T,>(set: (v: T | null) => void) =>
    (v: string | null) => {
      set(v as T | null);
      setPage(1);
    };

  const columns: Column<CouponRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (c) => (
        <Link to="/promotions/coupons/$id" params={{ id: c.id }}>
          {c.name}
        </Link>
      ),
    },
    { key: 'kind', header: 'Kind', render: (c) => KIND_LABEL[c.kind] },
    {
      key: 'code',
      header: 'Code',
      render: (c) => (c.code ? <code>{c.code}</code> : c.isBulk ? 'Bulk codes' : '-'),
    },
    {
      key: 'discount',
      header: 'Discount',
      render: (c) => (
        <div>
          <Text size="sm">{valueSummary(c)}</Text>
          <Text size="xs" c="dimmed">
            {TYPE_LABEL[c.type]}
          </Text>
        </div>
      ),
    },
    {
      key: 'phase',
      header: 'Status',
      render: (c) => (
        <Badge color={PHASE_COLOR[c.phase]} variant="light">
          {PHASE_LABEL[c.phase]}
        </Badge>
      ),
    },
    {
      key: 'uses',
      header: 'Uses',
      align: 'right',
      render: (c) => (c.maxUsesTotal ? `${c.usesCount} / ${c.maxUsesTotal}` : c.usesCount),
    },
    {
      key: 'given',
      header: 'Discount given',
      align: 'right',
      render: (c) =>
        c.budgetCapP
          ? `${formatPrice(c.discountGivenP)} / ${formatPrice(c.budgetCapP)}`
          : formatPrice(c.discountGivenP),
    },
    {
      key: 'window',
      header: 'Window',
      render: (c) => <Text size="sm">{windowSummary(c.startsAt, c.endsAt, formatDateTime)}</Text>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Codes and automatic discounts for the cart and checkout."
        actions={
          canManage && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              component={Link}
              to="/promotions/coupons/new"
            >
              New coupon
            </Button>
          )
        }
      />
      <Group mb="md" align="flex-end">
        <TextInput
          label="Search"
          placeholder="Name or code"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={240}
        />
        <Select
          label="Kind"
          placeholder="All"
          clearable
          data={opts(KIND_LABEL)}
          value={kind}
          onChange={filter(setKind)}
          w={150}
        />
        <Select
          label="Type"
          placeholder="All"
          clearable
          data={opts(TYPE_LABEL)}
          value={type}
          onChange={filter(setType)}
          w={170}
        />
        <Select
          label="Phase"
          placeholder="All"
          clearable
          data={opts(PHASE_LABEL)}
          value={phase}
          onChange={filter(setPhase)}
          w={140}
        />
        <Select
          label="Saved as"
          placeholder="All"
          clearable
          data={opts(STATUS_LABEL)}
          value={status}
          onChange={filter(setStatus)}
          w={130}
        />
      </Group>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        loading={list.isLoading}
        emptyMessage="No coupons match."
        page={page}
        pageSize={limit}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setLimit(n);
          setPage(1);
        }}
        onRowClick={(c) => navigate({ to: '/promotions/coupons/$id', params: { id: c.id } })}
      />
    </>
  );
}
