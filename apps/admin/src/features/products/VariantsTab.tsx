import { TableWrap } from '@bdc/ui';
import {
  Alert,
  Anchor,
  Badge,
  Checkbox,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Link } from '@tanstack/react-router';
import { MoneyInput } from '~/components/MoneyInput';
import { blankOption, OptionsEditor } from './OptionsEditor';
import { numOrNull } from './tabProps';
import classes from './VariantsTab.module.css';
import {
  comboCount,
  comboLabel,
  MAX_VARIANTS,
  type OptionDraft,
  skuProblems,
  syncRows,
  type VariantRowDraft,
} from './variants';

interface Props {
  options: OptionDraft[];
  rows: VariantRowDraft[];
  onChange: (options: OptionDraft[], rows: VariantRowDraft[]) => void;
  slug: string;
  canEdit: boolean;
  canEditPrice: boolean;
  canViewCost: boolean;
  /** SKUs the server reported as already used (409). */
  conflictSkus: ReadonlySet<string>;
}

export function VariantsTab({
  options,
  rows,
  onChange,
  slug,
  canEdit,
  canEditPrice,
  canViewCost,
  conflictSkus,
}: Props) {
  const disabled = !canEdit;
  const hasOptions = options.length > 0;
  const liveRows = rows.filter((r) => !r.retired);
  const retiredRows = rows.filter((r) => r.retired);
  const bad = skuProblems(rows);
  const tooMany = comboCount(options) > MAX_VARIANTS;

  const setOptions = (next: OptionDraft[]) => onChange(next, syncRows(next, rows, slug));
  const patchRow = (comboKey: string, patch: Partial<VariantRowDraft>) =>
    onChange(
      options,
      rows.map((r) => (r.comboKey === comboKey ? { ...r, ...patch } : r)),
    );

  return (
    <Stack gap="md">
      <Switch
        label="This product has options (size, color, ...)"
        description="Each combination gets its own SKU, price and stock. Up to 2 option types."
        disabled={disabled}
        checked={hasOptions}
        onChange={(e) => setOptions(e.currentTarget.checked ? [blankOption()] : [])}
      />
      {hasOptions && <OptionsEditor options={options} onChange={setOptions} disabled={disabled} />}
      {tooMany && (
        <Alert color="red" variant="light">
          These options make more than {MAX_VARIANTS} combinations; only the first {MAX_VARIANTS}{' '}
          are kept. Remove some values.
        </Alert>
      )}
      {!canEditPrice && (
        <Alert color="gray" variant="light">
          You do not have permission to edit prices, so price fields are read-only.
        </Alert>
      )}

      <Text size="sm" fw={600} className={classes.heading}>
        {hasOptions ? `Variants (${liveRows.length})` : 'Price and stock'}
      </Text>
      <TableWrap>
        <Table miw={900} className={classes.matrix}>
          <Table.Thead>
            <Table.Tr>
              {hasOptions && <Table.Th>Variant</Table.Th>}
              <Table.Th>SKU</Table.Th>
              <Table.Th>Barcode</Table.Th>
              <Table.Th className="num">Price</Table.Th>
              <Table.Th className="num">Compare-at</Table.Th>
              <Table.Th className="num">Sale price</Table.Th>
              <Table.Th>Sale from</Table.Th>
              <Table.Th>Sale until</Table.Th>
              {canViewCost && <Table.Th className="num">Cost</Table.Th>}
              <Table.Th className="num">Weight (g)</Table.Th>
              <Table.Th className="num">Low stock at</Table.Th>
              <Table.Th>Active</Table.Th>
              <Table.Th>Stock</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {liveRows.map((r) => {
              const label = comboLabel(options, r.valueKeys) || r.sku;
              const skuError = conflictSkus.has(r.sku.trim().toUpperCase())
                ? 'SKU already used'
                : bad.has(r.comboKey)
                  ? r.sku.trim()
                    ? 'Duplicate SKU'
                    : 'Required'
                  : undefined;
              return (
                <Table.Tr key={r.comboKey} className={skuError ? classes.bad : undefined}>
                  {hasOptions && (
                    <Table.Td>
                      <Text size="xs" fw={500} miw={90}>
                        {label}
                      </Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <TextInput
                      size="xs"
                      w={150}
                      aria-label={`SKU ${label}`}
                      maxLength={64}
                      disabled={disabled}
                      error={skuError}
                      value={r.sku}
                      onChange={(e) =>
                        patchRow(r.comboKey, { sku: e.currentTarget.value, skuAuto: false })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      w={110}
                      aria-label={`Barcode ${label}`}
                      maxLength={64}
                      disabled={disabled}
                      value={r.barcode}
                      onChange={(e) => patchRow(r.comboKey, { barcode: e.currentTarget.value })}
                    />
                  </Table.Td>
                  <Table.Td className="num">
                    <MoneyInput
                      size="xs"
                      w={100}
                      aria-label={`Price ${label}`}
                      disabled={disabled || !canEditPrice}
                      value={r.priceP}
                      onChange={(v) => patchRow(r.comboKey, { priceP: v })}
                    />
                  </Table.Td>
                  <Table.Td className="num">
                    <MoneyInput
                      size="xs"
                      w={100}
                      aria-label={`Compare-at price ${label}`}
                      disabled={disabled || !canEditPrice}
                      value={r.compareAtP}
                      onChange={(v) => patchRow(r.comboKey, { compareAtP: v })}
                    />
                  </Table.Td>
                  <Table.Td className="num">
                    <MoneyInput
                      size="xs"
                      w={100}
                      aria-label={`Sale price ${label}`}
                      disabled={disabled || !canEditPrice}
                      value={r.salePriceP}
                      onChange={(v) => patchRow(r.comboKey, { salePriceP: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <DateTimePicker
                      size="xs"
                      w={150}
                      clearable
                      aria-label={`Sale starts ${label}`}
                      valueFormat="DD MMM YY HH:mm"
                      disabled={disabled || !canEditPrice}
                      value={r.saleStartsAt}
                      onChange={(v) => patchRow(r.comboKey, { saleStartsAt: v })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <DateTimePicker
                      size="xs"
                      w={150}
                      clearable
                      aria-label={`Sale ends ${label}`}
                      valueFormat="DD MMM YY HH:mm"
                      disabled={disabled || !canEditPrice}
                      value={r.saleEndsAt}
                      onChange={(v) => patchRow(r.comboKey, { saleEndsAt: v })}
                    />
                  </Table.Td>
                  {canViewCost && (
                    <Table.Td className="num">
                      <MoneyInput
                        size="xs"
                        w={100}
                        aria-label={`Cost ${label}`}
                        disabled={disabled}
                        value={r.costP}
                        onChange={(v) => patchRow(r.comboKey, { costP: v })}
                      />
                    </Table.Td>
                  )}
                  <Table.Td className="num">
                    <NumberInput
                      size="xs"
                      w={80}
                      min={0}
                      hideControls
                      allowDecimal={false}
                      aria-label={`Weight ${label}`}
                      disabled={disabled}
                      value={r.weightG ?? ''}
                      onChange={(v) => patchRow(r.comboKey, { weightG: numOrNull(v) })}
                    />
                  </Table.Td>
                  <Table.Td className="num">
                    <NumberInput
                      size="xs"
                      w={80}
                      min={0}
                      hideControls
                      allowDecimal={false}
                      aria-label={`Low stock threshold ${label}`}
                      disabled={disabled}
                      value={r.lowStockThreshold ?? ''}
                      onChange={(v) => patchRow(r.comboKey, { lowStockThreshold: numOrNull(v) })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Active ${label}`}
                      disabled={disabled}
                      checked={r.isActive}
                      onChange={(e) => patchRow(r.comboKey, { isActive: e.currentTarget.checked })}
                    />
                  </Table.Td>
                  <Table.Td>
                    {r.id ? (
                      <Text size="xs" c={r.available <= 0 ? 'red' : undefined} miw={70}>
                        {r.available} available
                        <Text span size="xs" c="dimmed" display="block">
                          {r.onHand} on hand, {r.reserved} reserved
                        </Text>
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">
                        New
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </TableWrap>
      {retiredRows.length > 0 && (
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Retired variants
          </Text>
          <Text size="xs" c="dimmed">
            Removed from the product but kept because they have stock history. Read-only; they keep
            their SKU.
          </Text>
          {retiredRows.map((r) => (
            <Text key={r.id ?? r.sku} size="xs">
              <Badge size="xs" color="gray" variant="light" mr={6}>
                Retired
              </Badge>
              {r.sku} ({r.onHand} on hand)
            </Text>
          ))}
        </Stack>
      )}
      <Text size="xs" c="dimmed">
        Stock is read-only here. Change it on the{' '}
        <Anchor component={Link} to="/catalog/inventory" size="xs">
          Inventory page
        </Anchor>
        .
      </Text>
    </Stack>
  );
}
