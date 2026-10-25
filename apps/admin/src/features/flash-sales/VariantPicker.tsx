import { Button, Group, Loader, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyError } from '~/features/categories/queries';
import { flashApi } from './api';
import type { ItemDraft } from './logic';
import { variantSearchQuery } from './queries';

/** Search variants by SKU or product title and add them to the sale. */
export function VariantPicker({
  opened,
  onClose,
  taken,
  onPick,
}: {
  opened: boolean;
  onClose: () => void;
  /** Variant ids already in the sale. */
  taken: Set<string>;
  onPick: (draft: ItemDraft) => void;
}) {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const [busy, setBusy] = useState<string | null>(null);
  const results = useQuery(variantSearchQuery(q));

  async function pick(row: NonNullable<typeof results.data>['items'][number]) {
    setBusy(row.variantId);
    try {
      const product = await flashApi.productPrices(row.productId);
      const v = product.variants.find((x) => x.id === row.variantId);
      if (!v) throw new Error('Variant not found on the product');
      const label = row.optionLabels.map((o) => o.en).join(' / ');
      onPick({
        variantId: row.variantId,
        productTitleEn: label ? `${row.productTitleEn} (${label})` : row.productTitleEn,
        sku: row.sku,
        priceP: v.priceP,
        currentSalePriceP: null,
        qtySold: 0,
        flashPriceP: null,
        qtyLimit: null,
        perCustomerLimit: null,
        sort: 0,
      });
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Add a variant" size="lg">
      <Stack gap="sm">
        <TextInput
          label="Search"
          placeholder="SKU or product title (2+ letters)"
          data-autofocus
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={results.isFetching ? <Loader size="xs" /> : null}
        />
        {q.length >= 2 && results.data?.items.length === 0 && (
          <Text size="sm" c="dimmed">
            No variants found.
          </Text>
        )}
        {results.data?.items.map((r) => {
          const label = r.optionLabels.map((o) => o.en).join(' / ');
          const inSale = taken.has(r.variantId);
          return (
            <Group key={r.variantId} justify="space-between" wrap="nowrap">
              <div>
                <Text size="sm">
                  {r.productTitleEn}
                  {label ? ` (${label})` : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {r.sku} / {r.available} available
                </Text>
              </div>
              <Button
                size="xs"
                variant="light"
                disabled={inSale}
                loading={busy === r.variantId}
                onClick={() => pick(r)}
              >
                {inSale ? 'Added' : 'Add'}
              </Button>
            </Group>
          );
        })}
      </Stack>
    </Modal>
  );
}
