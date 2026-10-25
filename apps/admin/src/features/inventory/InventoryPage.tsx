import { StatusBadge, Toolbar } from '@bdc/ui';
import { Anchor, Badge, Button, Checkbox, Group, Select, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatNumber } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { AdjustModal } from './AdjustModal';
import { CategorySelect } from './CategorySelect';
import { HistoryDrawer } from './HistoryDrawer';
import classes from './InventoryPage.module.css';
import { optionText } from './logic';
import { type InventoryRow, inventoryListQuery, lowStockCountQuery } from './queries';
import { DEFAULT_PAGE_SIZE, type InventorySearch, PAGE_SIZES } from './search';
import { ThresholdCell } from './ThresholdCell';

interface Props {
  search: InventorySearch;
  /** Merge a patch into the URL search params (undefined removes a key). */
  onSearch: (patch: Partial<InventorySearch>) => void;
}

export function InventoryPage({ search, onSearch }: Props) {
  const canAdjust = useCan('inventory.adjust');
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [history, setHistory] = useState<InventoryRow | null>(null);

  const [qInput, setQInput] = useState(search.q ?? '');
  const [debouncedQ] = useDebouncedValue(qInput, 300);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to the debounced input
  useEffect(() => {
    const next = debouncedQ.trim() || undefined;
    if (next !== search.q) onSearch({ q: next, page: undefined });
  }, [debouncedQ]);

  const pageSize = search.size ?? DEFAULT_PAGE_SIZE;
  const list = useQuery(inventoryListQuery(search));
  const low = useQuery(lowStockCountQuery);

  const columns: Column<InventoryRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => {
        const options = optionText(r.optionLabels);
        return (
          <div>
            <Anchor
              size="sm"
              fw={500}
              renderRoot={(props) => (
                <Link to="/catalog/products/$id" params={{ id: r.productId }} {...props} />
              )}
            >
              {r.productTitleEn}
            </Anchor>
            {options && (
              <Text size="xs" c="dimmed">
                {options}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (r) => <span className={classes.mono}>{r.sku}</span>,
    },
    {
      key: 'fulfillment',
      header: '',
      render: (r) =>
        r.fulfillment === 'dropship' ? <StatusBadge tone="info">Dropship</StatusBadge> : null,
    },
    {
      key: 'onHand',
      className: 'num',
      header: 'On hand',
      align: 'right',
      render: (r) => formatNumber(r.onHand),
    },
    {
      key: 'reserved',
      className: 'num',
      header: 'Reserved',
      align: 'right',
      render: (r) => formatNumber(r.reserved),
    },
    {
      key: 'available',
      className: 'num',
      header: 'Available',
      align: 'right',
      render: (r) => (
        <Text
          span
          className={`${classes.qty} ${r.available <= 0 ? classes.out : r.isLow ? classes.low : ''}`}
          aria-label={r.isLow ? 'Low stock' : undefined}
        >
          {formatNumber(r.available)}
        </Text>
      ),
    },
    {
      key: 'threshold',
      className: 'num',
      header: 'Threshold',
      align: 'right',
      width: 140,
      render: (r) => <ThresholdCell row={r} canEdit={canAdjust} />,
    },
    {
      key: 'actions',
      className: 'act',
      header: '',
      align: 'right',
      render: (r) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          {canAdjust && (
            <Button size="compact-xs" variant="light" onClick={() => setAdjusting(r)}>
              Adjust
            </Button>
          )}
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setHistory(r)}>
            History
          </Button>
        </Group>
      ),
    },
  ];

  const lowCount = low.data?.count;

  return (
    <>
      <PageHeader
        title="Inventory"
        crumbs={['Catalog', 'Inventory']}
        description="Stock per variant. Every change is recorded in the stock history."
        actions={
          lowCount !== undefined && (
            <Badge
              size="lg"
              variant={search.lowStock ? 'filled' : 'light'}
              color={lowCount > 0 ? 'orange' : 'green'}
              className={classes.chip}
              onClick={() =>
                onSearch({ lowStock: search.lowStock ? undefined : true, page: undefined })
              }
            >
              {lowCount} low stock
            </Badge>
          )
        }
      />
      <Toolbar className={classes.toolbar}>
        <TextInput
          label="Search"
          placeholder="Product or SKU"
          leftSection={<IconSearch size={14} />}
          value={qInput}
          onChange={(e) => setQInput(e.currentTarget.value)}
          className="grow"
        />
        <CategorySelect
          label="Category"
          w={240}
          value={search.category}
          onChange={(id) => onSearch({ category: id ?? undefined, page: undefined })}
        />
        <Select
          label="Fulfillment"
          w={150}
          placeholder="All"
          clearable
          data={[
            { value: 'stock', label: 'Own stock' },
            { value: 'dropship', label: 'Dropship' },
          ]}
          value={search.fulfillment ?? null}
          onChange={(v) =>
            onSearch({
              fulfillment: (v as 'stock' | 'dropship' | null) ?? undefined,
              page: undefined,
            })
          }
        />
        <Checkbox
          label="Low stock only"
          pb={6}
          checked={!!search.lowStock}
          onChange={(e) =>
            onSearch({ lowStock: e.currentTarget.checked ? true : undefined, page: undefined })
          }
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(r) => r.variantId}
        loading={list.isLoading}
        emptyMessage="No variants match these filters."
        page={search.page ?? 1}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={(p) => onSearch({ page: p > 1 ? p : undefined })}
        onPageSizeChange={(s) => onSearch({ size: s, page: undefined })}
        pageSizeOptions={PAGE_SIZES}
      />
      <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} />
      <HistoryDrawer row={history} onClose={() => setHistory(null)} />
    </>
  );
}
