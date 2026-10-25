import { SectionCard, Toolbar } from '@bdc/ui';
import {
  Alert,
  Badge,
  Button,
  CloseButton,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime } from '~/lib/format';
import { couponsApi } from './api';
import classes from './Coupons.module.css';
import { notifyCouponError } from './errors';
import type { CustomerRef } from './form';
import type { CouponDetail } from './logic';
import { CustomerSelect } from './pickers';
import { codesQuery, useInvalidateCoupons } from './queries';

type CodeRow = Awaited<ReturnType<typeof couponsApi.codes>>['items'][number];

/** Generated one-time codes of a bulk coupon: generate, browse, export, hand to a customer. */
export function CodesTab({ coupon }: { coupon: CouponDetail }) {
  const invalidate = useInvalidateCoupons();
  const [status, setStatus] = useState<'used' | 'unused' | null>(null);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const list = useQuery(
    codesQuery(coupon.id, { status: status ?? undefined, q: q || undefined, page, limit: 50 }),
  );

  const [count, setCount] = useState<number | ''>(100);
  const [prefix, setPrefix] = useState('');
  const [length, setLength] = useState<number | ''>(8);
  const generate = useMutation({
    mutationFn: () =>
      couponsApi.generate(coupon.id, {
        count: Number(count),
        length: Number(length) || 8,
        prefix: prefix.trim() || undefined,
      }),
    onSuccess: async (r) => {
      notifyOk(`Generated ${r.generated} codes (${r.total} in total)`);
      await invalidate();
    },
    onError: (e) => notifyCouponError(e),
  });

  const [customer, setCustomer] = useState<CustomerRef | null>(null);
  const [assignCount, setAssignCount] = useState<number | ''>(1);
  const [assigned, setAssigned] = useState<string[] | null>(null);
  const assign = useMutation({
    mutationFn: () =>
      couponsApi.assign(coupon.id, { customerId: customer?.id ?? '', count: Number(assignCount) }),
    onSuccess: async (r) => {
      setAssigned(r.codes);
      await invalidate();
    },
    onError: (e) => notifyCouponError(e),
  });

  const exportCsv = useMutation({
    mutationFn: () => couponsApi.exportCodes(coupon.id),
    onError: (e) => notifyCouponError(e, 'Export failed'),
  });

  const columns: Column<CodeRow>[] = [
    { key: 'code', header: 'Code', render: (r) => <span className={classes.code}>{r.code}</span> },
    {
      key: 'state',
      header: 'Status',
      render: (r) =>
        r.usedAt ? (
          <Badge color="gray" variant="light">
            Used {formatDateTime(r.usedAt)}
          </Badge>
        ) : (
          <Badge color="teal" variant="light">
            Unused
          </Badge>
        ),
    },
    {
      key: 'who',
      header: 'Assigned to',
      render: (r) =>
        r.assignedCustomer
          ? `${r.assignedCustomer.name}${r.assignedCustomer.phone ? ` - ${r.assignedCustomer.phone}` : ''}`
          : '-',
    },
  ];

  const { total, used, assigned: assignedCount } = coupon.codeStats;
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {total} codes, {used} used, {assignedCount} assigned to customers, {total - used} unused.
      </Text>

      <SectionCard title="Generate codes" bodyClassName={classes.sectionBody}>
        <>
          <Group align="flex-end">
            <NumberInput
              label="How many"
              min={1}
              max={5000}
              allowDecimal={false}
              hideControls
              w={120}
              value={count}
              onChange={(n) => setCount(typeof n === 'number' ? n : '')}
            />
            <TextInput
              label="Prefix"
              description="Optional, up to 12 letters or digits"
              maxLength={12}
              w={200}
              value={prefix}
              onChange={(e) => setPrefix(e.currentTarget.value.toUpperCase())}
            />
            <NumberInput
              label="Random part length"
              min={6}
              max={12}
              allowDecimal={false}
              w={150}
              value={length}
              onChange={(n) => setLength(typeof n === 'number' ? n : '')}
            />
            <Button
              loading={generate.isPending}
              disabled={!count || !/^[A-Za-z0-9]{0,12}$/.test(prefix)}
              onClick={() => generate.mutate()}
            >
              Generate
            </Button>
          </Group>
        </>
      </SectionCard>

      <SectionCard title="Give codes to a customer" bodyClassName={classes.sectionBody}>
        <>
          {customer ? (
            <Group gap="xs">
              <Text size="sm">
                {customer.name}
                {customer.phone ? ` - ${customer.phone}` : ''}
              </Text>
              <CloseButton
                aria-label="Clear customer"
                size="sm"
                onClick={() => setCustomer(null)}
              />
            </Group>
          ) : (
            <CustomerSelect label="Customer" onPick={setCustomer} />
          )}
          <Group align="flex-end">
            <NumberInput
              label="Codes"
              min={1}
              max={1000}
              allowDecimal={false}
              hideControls
              w={120}
              value={assignCount}
              onChange={(n) => setAssignCount(typeof n === 'number' ? n : '')}
            />
            <Button
              variant="default"
              loading={assign.isPending}
              disabled={!customer || !assignCount}
              onClick={() => assign.mutate()}
            >
              Assign
            </Button>
          </Group>
          {assigned && (
            <Alert
              color="teal"
              variant="light"
              title={`${assigned.length} codes assigned`}
              withCloseButton
              onClose={() => setAssigned(null)}
            >
              {assigned.join(', ')}
            </Alert>
          )}
        </>
      </SectionCard>

      <Toolbar className={classes.toolbar}>
        <Group align="flex-end">
          <TextInput
            label="Search"
            placeholder="Part of a code"
            w={220}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setPage(1);
            }}
          />
          <Select
            label="Status"
            placeholder="All"
            clearable
            w={150}
            data={[
              { value: 'unused', label: 'Unused' },
              { value: 'used', label: 'Used' },
            ]}
            value={status}
            onChange={(s) => {
              setStatus(s as 'used' | 'unused' | null);
              setPage(1);
            }}
          />
        </Group>
        <span className="a-sp" />
        <Button variant="default" loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
          Export CSV
        </Button>
      </Toolbar>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        emptyMessage="No codes yet."
        page={page}
        pageSize={50}
        total={list.data?.total}
        onPageChange={setPage}
        pageSizeOptions={[50]}
      />
    </Stack>
  );
}
