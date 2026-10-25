import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { MoneyInput } from '~/components/MoneyInput';
import { zonesQuery } from '~/features/delivery/queries';
import { formatPrice } from '~/lib/format';
import { Section, type SectionProps } from './fields';
import { type CouponType, TYPE_HELP, TYPE_LABEL } from './logic';
import { ProductIdList, ProductName, ProductSelect } from './pickers';

const TYPES = Object.keys(TYPE_LABEL) as CouponType[];

export function DiscountSection(p: SectionProps) {
  const { v, set, disabled, locked, issues } = p;
  const off = disabled;
  return (
    <Section title="Discount" issues={issues}>
      <Select
        label="Type"
        description={locked ? 'Locked: this coupon was already used in orders.' : TYPE_HELP[v.type]}
        allowDeselect={false}
        disabled={off || locked}
        data={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        value={v.type}
        onChange={(t) => set({ type: (t ?? 'percent') as CouponType })}
      />

      {v.type === 'percent' && (
        <Group grow align="flex-start">
          <NumberInput
            label="Percent off"
            required
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
            hideControls
            disabled={off}
            value={v.percent}
            onChange={(n) => set({ percent: typeof n === 'number' ? n : '' })}
          />
          <MoneyInput
            label="Maximum discount"
            description="Optional cap per order."
            disabled={off}
            value={v.maxDiscountP}
            onChange={(x) => set({ maxDiscountP: x })}
          />
        </Group>
      )}

      {v.type === 'fixed' && (
        <MoneyInput
          label="Amount off"
          required
          disabled={off}
          value={v.fixedP}
          onChange={(x) => set({ fixedP: x })}
        />
      )}

      {v.type === 'free_delivery' && <ZoneSelect {...p} />}
      {v.type === 'tiered' && <TiersTable {...p} />}
      {v.type === 'bxgy' && <BxgyFields {...p} />}
      {v.type === 'bundle' && <BundleFields {...p} />}
    </Section>
  );
}

function ZoneSelect({ v, set, disabled }: SectionProps) {
  const zones = useQuery(zonesQuery);
  return (
    <MultiSelect
      label="Delivery zones"
      description="Empty = free delivery in every zone."
      placeholder={v.zoneIds.length ? undefined : 'All zones'}
      searchable
      clearable
      disabled={disabled}
      data={(zones.data ?? []).map((z) => ({ value: z.id, label: z.nameEn }))}
      value={v.zoneIds}
      onChange={(ids) => set({ zoneIds: ids })}
    />
  );
}

function TiersTable({ v, set, disabled }: SectionProps) {
  const update = (i: number, patch: Partial<(typeof v.tiers)[number]>) =>
    set({ tiers: v.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <Stack gap="xs">
      <Text size="sm">Tiers</Text>
      <Text size="xs" c="dimmed">
        The highest tier the cart qualifies for applies. Minimum spend must go up from row to row.
      </Text>
      {v.tiers.length > 0 && (
        <Table withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Spend at least</Table.Th>
              <Table.Th>Discount</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {v.tiers.map((t, i) => (
              // Rows have no id; index is the identity while editing.
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
              <Table.Tr key={i}>
                <Table.Td>
                  <MoneyInput
                    aria-label={`Tier ${i + 1} minimum spend`}
                    disabled={disabled}
                    value={t.minSpendP}
                    onChange={(x) => update(i, { minSpendP: x })}
                  />
                </Table.Td>
                <Table.Td>
                  <MoneyInput
                    aria-label={`Tier ${i + 1} discount`}
                    disabled={disabled}
                    value={t.discountP}
                    onChange={(x) => update(i, { discountP: x })}
                  />
                </Table.Td>
                <Table.Td>
                  {!disabled && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Remove tier ${i + 1}`}
                      onClick={() => set({ tiers: v.tiers.filter((_, j) => j !== i) })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {!disabled && (
        <div>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              const last = v.tiers.at(-1);
              set({
                tiers: [
                  ...v.tiers,
                  { minSpendP: last?.minSpendP ? last.minSpendP * 2 : null, discountP: null },
                ],
              });
            }}
          >
            Add tier
          </Button>
        </div>
      )}
    </Stack>
  );
}

function BxgyFields({ v, set, disabled }: SectionProps) {
  return (
    <Stack gap="sm">
      <Group grow align="flex-start">
        <NumberInput
          label="Buy (units)"
          min={1}
          max={100}
          allowDecimal={false}
          disabled={disabled}
          value={v.buyQty}
          onChange={(n) => set({ buyQty: typeof n === 'number' ? n : 1 })}
        />
        <NumberInput
          label="Get (units)"
          min={1}
          max={100}
          allowDecimal={false}
          disabled={disabled}
          value={v.getQty}
          onChange={(n) => set({ getQty: typeof n === 'number' ? n : 1 })}
        />
        <NumberInput
          label="Discount on those units"
          description="100% = free."
          min={0.01}
          max={100}
          decimalScale={2}
          suffix="%"
          hideControls
          disabled={disabled}
          value={v.getPercent}
          onChange={(n) => set({ getPercent: typeof n === 'number' ? n : '' })}
        />
      </Group>
      <Text size="xs" c="dimmed">
        The "buy" items are whatever the Scope section allows (the whole catalogue if empty).
      </Text>
      <Switch
        label="The cheapest eligible units are the discounted ones"
        description="Off: only the products chosen below get the discount."
        disabled={disabled}
        checked={v.getSame}
        onChange={(e) => set({ getSame: e.currentTarget.checked })}
      />
      {!v.getSame && (
        <Stack gap="xs">
          <ProductSelect
            label="Discounted products"
            disabled={disabled}
            onPick={(pr) =>
              !v.getProductIds.includes(pr.id) &&
              set({ getProductIds: [...v.getProductIds, pr.id] })
            }
          />
          <ProductIdList
            ids={v.getProductIds}
            disabled={disabled}
            onRemove={(id) => set({ getProductIds: v.getProductIds.filter((x) => x !== id) })}
          />
        </Stack>
      )}
    </Stack>
  );
}

function BundleFields({ v, set, disabled }: SectionProps) {
  return (
    <Stack gap="sm">
      <ProductSelect
        label="Add a product to the bundle"
        disabled={disabled}
        onPick={(pr) =>
          !v.bundleItems.some((i) => i.productId === pr.id) &&
          set({ bundleItems: [...v.bundleItems, { productId: pr.id, qty: 1 }] })
        }
      />
      {v.bundleItems.length > 0 && (
        <Table withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Product (any variant)</Table.Th>
              <Table.Th w={110}>Quantity</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {v.bundleItems.map((it, i) => (
              <Table.Tr key={it.productId}>
                <Table.Td>
                  <ProductName id={it.productId} />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    aria-label="Quantity"
                    min={1}
                    max={100}
                    allowDecimal={false}
                    disabled={disabled}
                    value={it.qty}
                    onChange={(n) =>
                      set({
                        bundleItems: v.bundleItems.map((x, j) =>
                          j === i ? { ...x, qty: typeof n === 'number' ? n : 1 } : x,
                        ),
                      })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  {!disabled && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="Remove from bundle"
                      onClick={() => set({ bundleItems: v.bundleItems.filter((_, j) => j !== i) })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <MoneyInput
        label="Price for one full set"
        description={
          v.bundlePriceP
            ? `One set costs ${formatPrice(v.bundlePriceP)}.`
            : 'At least two products.'
        }
        disabled={disabled}
        value={v.bundlePriceP}
        onChange={(x) => set({ bundlePriceP: x })}
      />
    </Stack>
  );
}
