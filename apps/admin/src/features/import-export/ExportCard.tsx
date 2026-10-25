import { SectionCard } from '@bdc/ui';
import { Button, Group, SegmentedControl, Select, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { CategorySelect } from '~/features/inventory/CategorySelect';
import { useCan } from '~/lib/perm';
import { downloadFile, type FileFormat } from './api';

export function ExportCard() {
  const canView = useCan('products.view');
  const [format, setFormat] = useState<FileFormat>('xlsx');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);

  const brands = useQuery({
    queryKey: ['brands'],
    queryFn: () => unwrap(api.GET('/v1/admin/brands')),
    enabled: canView,
  });

  const run = useMutation({
    mutationFn: () =>
      downloadFile(
        '/v1/admin/products/export',
        {
          format,
          q: q.trim() || undefined,
          status: status ?? undefined,
          categoryId: categoryId ?? undefined,
          brandId: brandId ?? undefined,
        },
        `products.${format}`,
      ),
    onSuccess: (name) => notifications.show({ color: 'green', message: `Downloaded ${name}` }),
    onError: (e) =>
      notifications.show({ color: 'red', title: 'Export failed', message: e.message }),
  });

  return (
    <SectionCard title="Export products">
      <Stack gap="sm">
        <p className="a-hint">One row per variant. Leave the filters empty to export everything.</p>
        <SegmentedControl
          w={180}
          value={format}
          onChange={(v) => setFormat(v as FileFormat)}
          data={[
            { value: 'xlsx', label: 'XLSX' },
            { value: 'csv', label: 'CSV' },
          ]}
        />
        <Group align="flex-end" gap="sm">
          <TextInput
            label="Search"
            placeholder="Title or SKU"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            w={200}
          />
          <Select
            label="Status"
            placeholder="Any"
            clearable
            w={140}
            data={[
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <CategorySelect label="Category" w={220} value={categoryId} onChange={setCategoryId} />
          <Select
            label="Brand"
            placeholder="Any"
            clearable
            searchable
            w={180}
            disabled={!canView}
            data={(brands.data ?? []).map((b) => ({ value: b.id, label: b.nameEn }))}
            value={brandId}
            onChange={setBrandId}
          />
        </Group>
        <Group>
          <Button loading={run.isPending} onClick={() => run.mutate()}>
            Download {format.toUpperCase()}
          </Button>
        </Group>
      </Stack>
    </SectionCard>
  );
}
