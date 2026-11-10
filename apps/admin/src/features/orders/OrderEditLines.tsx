import { ActionIcon, NumberInput, Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatPrice } from '~/lib/format';
import { ordersApi } from './api';
import type { DraftLine } from './edit-logic';
import classes from './Orders.module.css';

/** Qty steppers and remove buttons for the lines, plus a search to add another variant. */
export function OrderEditLines({
  lines,
  onChange,
}: {
  lines: DraftLine[];
  onChange: (next: DraftLine[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const found = useQuery({
    queryKey: ['orders', 'variant-search', q],
    queryFn: () => ordersApi.searchVariants(q),
    enabled: q.length >= 2,
  });
  const rows = found.data?.items ?? [];
  const taken = new Set(lines.map((l) => l.variantId));
  const patch = (key: string, p: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...p } : l)));

  return (
    <div>
      {lines.map((l) => (
        <div key={l.key} className={classes.editLine}>
          <div>
            <div className={classes.itemTitle}>
              {l.title}
              {l.orderItemId === null && <span className={classes.newTag}> new</span>}
            </div>
            <div className={`${classes.muted} ${classes.small}`}>
              {l.sub}
              {l.unitPriceP !== null && ` · ${formatPrice(l.unitPriceP)} each`}
            </div>
          </div>
          <NumberInput
            aria-label={`Quantity of ${l.title}`}
            w={92}
            min={0}
            max={l.maxQty ?? 1000}
            allowDecimal={false}
            clampBehavior="strict"
            value={l.qty}
            onChange={(v) => patch(l.key, { qty: typeof v === 'number' ? v : 0 })}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Remove ${l.title}`}
            onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
          >
            ×
          </ActionIcon>
        </div>
      ))}
      <Select
        mt="sm"
        label="Add item"
        placeholder="Search product name or SKU (2+ letters)"
        searchable
        value={null}
        searchValue={search}
        onSearchChange={setSearch}
        nothingFoundMessage={found.isFetching ? 'Searching...' : 'No products found'}
        filter={({ options }) => options}
        data={rows.map((r) => ({
          value: r.variantId,
          label: `${r.productTitleEn}${r.optionLabels.length ? ` (${r.optionLabels.map((o) => o.en).join(' / ')})` : ''} · ${r.sku}`,
          disabled: taken.has(r.variantId),
        }))}
        onChange={(v) => {
          const r = rows.find((x) => x.variantId === v);
          if (!r) return;
          onChange([
            ...lines,
            {
              key: `new-${r.variantId}`,
              orderItemId: null,
              variantId: r.variantId,
              title: r.productTitleEn,
              sub: [r.optionLabels.map((o) => o.en).join(' / '), r.sku].filter(Boolean).join(' · '),
              qty: 1,
              origQty: 0,
              unitPriceP: null,
            },
          ]);
          setSearch('');
        }}
      />
    </div>
  );
}
