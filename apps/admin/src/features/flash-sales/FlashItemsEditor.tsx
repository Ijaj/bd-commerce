import { ActionIcon, Alert, Button, Group, NumberInput, Table, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { flashApi } from './api';
import {
  discountPercent,
  draftFromItem,
  flashErrorMessage,
  type ItemDraft,
  itemProblem,
  toItemBodies,
} from './logic';
import { type FlashDetail, useInvalidateFlash } from './queries';
import { VariantPicker } from './VariantPicker';

/** Items table: edits stay local until "Save items", which replaces the whole list like the API does. */
export function FlashItemsEditor({ sale, canManage }: { sale: FlashDetail; canManage: boolean }) {
  const invalidate = useInvalidateFlash();
  const [drafts, setDrafts] = useState<ItemDraft[]>(() => sale.items.map(draftFromItem));
  const [picking, setPicking] = useState(false);
  const taken = useMemo(() => new Set(drafts.map((d) => d.variantId)), [drafts]);
  const problems = drafts.map(itemProblem);
  const hasProblem = problems.some(Boolean);

  const patch = (variantId: string, change: Partial<ItemDraft>) =>
    setDrafts((all) => all.map((d) => (d.variantId === variantId ? { ...d, ...change } : d)));

  const save = useMutation({
    mutationFn: () => flashApi.replaceItems(sale.id, toItemBodies(drafts)),
    onSuccess: (saved) => {
      notifyOk('Items saved');
      setDrafts(saved.items.map(draftFromItem));
      invalidate();
    },
  });

  return (
    <div>
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          A variant can be in only one active flash sale at a time. Items that already sold cannot
          be removed.
        </Text>
        {canManage && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setPicking(true)}
          >
            Add variant
          </Button>
        )}
      </Group>
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Variant</Table.Th>
              <Table.Th ta="right">Regular</Table.Th>
              <Table.Th>Flash price</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Per customer</Table.Th>
              <Table.Th ta="right">Sold</Table.Th>
              <Table.Th>Sort</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {drafts.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No items yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {drafts.map((d, i) => {
              const pct = discountPercent(d.priceP, d.flashPriceP);
              const problem = problems[i];
              return (
                <Table.Tr key={d.variantId}>
                  <Table.Td>
                    <Text size="sm">{d.productTitleEn}</Text>
                    <Text size="xs" c="dimmed">
                      {d.sku}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{formatPrice(d.priceP)}</Text>
                    {d.currentSalePriceP !== null && (
                      <Text size="xs" c="dimmed">
                        On sale now: {formatPrice(d.currentSalePriceP)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <MoneyInput
                      aria-label={`Flash price for ${d.sku}`}
                      w={120}
                      disabled={!canManage}
                      value={d.flashPriceP}
                      onChange={(v) => patch(d.variantId, { flashPriceP: v })}
                      error={problem && d.flashPriceP !== null && d.flashPriceP >= d.priceP}
                    />
                    {pct !== null && pct > 0 && (
                      <Text size="xs" c="dimmed">
                        {pct}% off
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`Quantity for ${d.sku}`}
                      w={90}
                      min={Math.max(1, d.qtySold)}
                      allowDecimal={false}
                      hideControls
                      disabled={!canManage}
                      value={d.qtyLimit ?? ''}
                      onChange={(v) =>
                        patch(d.variantId, { qtyLimit: v === '' ? null : Number(v) })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`Per-customer limit for ${d.sku}`}
                      w={90}
                      min={1}
                      allowDecimal={false}
                      hideControls
                      placeholder="None"
                      disabled={!canManage}
                      value={d.perCustomerLimit ?? ''}
                      onChange={(v) =>
                        patch(d.variantId, { perCustomerLimit: v === '' ? null : Number(v) })
                      }
                    />
                  </Table.Td>
                  <Table.Td ta="right">{d.qtySold}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`Sort for ${d.sku}`}
                      w={70}
                      min={0}
                      allowDecimal={false}
                      hideControls
                      disabled={!canManage}
                      value={d.sort}
                      onChange={(v) => patch(d.variantId, { sort: Number(v) || 0 })}
                    />
                  </Table.Td>
                  <Table.Td>
                    {canManage && (
                      <Tooltip
                        label="Already sold, cannot be removed"
                        disabled={d.qtySold === 0}
                        withArrow
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Remove ${d.sku}`}
                          disabled={d.qtySold > 0}
                          onClick={() => setDrafts((all) => all.filter((x) => x !== d))}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {problems.some(Boolean) && (
        <Text size="xs" c="red" mt="xs" role="alert">
          {drafts
            .map((d, i) => (problems[i] ? `${d.sku}: ${problems[i]}` : null))
            .filter(Boolean)
            .join('. ')}
        </Text>
      )}
      {save.error && (
        <Alert color="red" mt="sm" role="alert">
          {flashErrorMessage(save.error)}
        </Alert>
      )}
      {canManage && (
        <Group mt="md">
          <Button disabled={hasProblem} loading={save.isPending} onClick={() => save.mutate()}>
            Save items
          </Button>
        </Group>
      )}
      <VariantPicker
        opened={picking}
        onClose={() => setPicking(false)}
        taken={taken}
        onPick={(d) => {
          setDrafts((all) => [...all, { ...d, sort: all.length }]);
          setPicking(false);
        }}
      />
    </div>
  );
}
