import { Button, Group, Select, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { PHASE_LABEL } from './logic';
import { PhaseBadge } from './PhaseBadge';
import { type FlashPhase, type FlashRow, flashListQuery } from './queries';

const PHASE_OPTIONS = (Object.keys(PHASE_LABEL) as FlashPhase[]).map((value) => ({
  value,
  label: PHASE_LABEL[value],
}));

export function FlashSalesPage() {
  const navigate = useNavigate();
  const canManage = useCan('flash_sales.manage');
  const [phase, setPhase] = useState<FlashPhase | null>(null);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const list = useQuery(
    flashListQuery({ phase: phase ?? undefined, q: q || undefined, page, pageSize }),
  );

  const columns: Column<FlashRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <Link to="/promotions/flash-sales/$id" params={{ id: r.id }}>
          {r.nameEn}
        </Link>
      ),
    },
    { key: 'phase', header: 'Phase', render: (r) => <PhaseBadge phase={r.phase} /> },
    {
      key: 'window',
      header: 'Window',
      render: (r) => (
        <Text size="sm">
          {formatDateTime(r.startsAt)} to {formatDateTime(r.endsAt)}
        </Text>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', render: (r) => r.itemCount },
    { key: 'sold', header: 'Units sold', align: 'right', render: (r) => r.unitsSold },
  ];

  return (
    <>
      <PageHeader
        title="Flash sales"
        description="Time-boxed prices on limited quantities."
        actions={
          canManage && (
            <Button
              component={Link}
              to="/promotions/flash-sales/new"
              leftSection={<IconPlus size={16} />}
            >
              New flash sale
            </Button>
          )
        }
      />
      <Group mb="md" align="flex-end">
        <TextInput
          label="Search"
          placeholder="Sale name"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          w={260}
        />
        <Select
          label="Phase"
          placeholder="All"
          clearable
          data={PHASE_OPTIONS}
          value={phase}
          onChange={(v) => {
            setPhase(v as FlashPhase | null);
            setPage(1);
          }}
          w={160}
        />
      </Group>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage="No flash sales match."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        onRowClick={(r) => navigate({ to: '/promotions/flash-sales/$id', params: { id: r.id } })}
      />
    </>
  );
}
