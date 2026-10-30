import { Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatPrice } from '~/lib/format';
import type { LineDraft } from './logic';
import { optionText } from './logic';
import { type PoVariantOption, variantOptionsQuery } from './queries';

export function lineFromOption(o: PoVariantOption): LineDraft {
  const cost = o.lastCostP ?? o.variantCostP;
  return {
    key: o.variantId,
    variantId: o.variantId,
    title: o.productTitleEn,
    sku: o.sku,
    options: o.options,
    qty: 1,
    unitCostP: cost,
    hint: o.linked
      ? `linked${o.lastCostP !== null ? `, last cost ${formatPrice(o.lastCostP)}` : ''}`
      : null,
  };
}

/** Searchable variant list for the chosen supplier: linked products first, dropship ones disabled. */
export function VariantPicker({
  supplierId,
  taken,
  onPick,
}: {
  supplierId: string;
  taken: Set<string>;
  onPick: (line: LineDraft) => void;
}) {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 250);
  const opts = useQuery(variantOptionsQuery(supplierId, q));
  const byId = new Map((opts.data ?? []).map((o) => [o.variantId, o]));

  return (
    <Select
      label="Add line"
      placeholder={supplierId ? 'Search product name or SKU' : 'Choose a supplier first'}
      searchable
      clearable={false}
      disabled={!supplierId}
      value={null}
      searchValue={search}
      onSearchChange={setSearch}
      nothingFoundMessage={opts.isLoading ? 'Searching...' : 'No products found'}
      filter={({ options }) => options}
      data={(opts.data ?? []).map((o) => ({
        value: o.variantId,
        label: `${o.productTitleEn}${optionText(o.options)} · ${o.sku}`,
        disabled: o.fulfillment === 'dropship' || taken.has(o.variantId),
      }))}
      renderOption={({ option }) => {
        const o = byId.get(option.value);
        if (!o) return option.label;
        return (
          <div>
            <div>{option.label}</div>
            <span className="sub">
              {o.fulfillment === 'dropship'
                ? 'Dropship: not on purchase orders'
                : taken.has(o.variantId)
                  ? 'Already on this order'
                  : `${o.linked ? `Linked${o.lastCostP !== null ? `, last cost ${formatPrice(o.lastCostP)}` : ''} · ` : ''}${o.onHand} on hand`}
            </span>
          </div>
        );
      }}
      onChange={(v) => {
        const o = v ? byId.get(v) : undefined;
        if (o) {
          onPick(lineFromOption(o));
          setSearch('');
        }
      }}
    />
  );
}
