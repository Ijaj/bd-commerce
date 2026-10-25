import {
  Badge,
  CloseButton,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { MoneyInput } from '~/components/MoneyInput';
import { OptInt, Section, type SectionProps } from './fields';
import { PLATFORM_LABEL, SEGMENT_LABEL } from './logic';
import { CustomerSelect } from './pickers';

export function ConditionsSection({ v, set, disabled, issues }: SectionProps) {
  // Online payments are off for now, so cash on delivery is the only method to pick.
  // Keep any method already stored so saving does not silently drop it.
  const methods = [...new Set(['cod', ...v.paymentMethods])];
  return (
    <Section title="Conditions" issues={issues}>
      <Group grow align="flex-start">
        <MoneyInput
          label="Minimum order"
          description="Empty = no minimum."
          disabled={disabled}
          value={v.minOrderP}
          onChange={(x) => set({ minOrderP: x })}
        />
        <OptInt
          label="Minimum quantity"
          description="Eligible units in the cart."
          disabled={disabled}
          value={v.minQty}
          onChange={(x) => set({ minQty: x })}
        />
      </Group>
      <Group grow align="flex-start">
        <DateTimePicker
          label="Starts at"
          description="Empty = no start limit"
          clearable
          disabled={disabled}
          valueFormat="DD MMM YYYY HH:mm"
          value={v.startsAt}
          onChange={(x) => set({ startsAt: x })}
        />
        <DateTimePicker
          label="Ends at"
          description="Empty = never ends"
          clearable
          disabled={disabled}
          valueFormat="DD MMM YYYY HH:mm"
          value={v.endsAt}
          onChange={(x) => set({ endsAt: x })}
        />
      </Group>
      <Select
        label="Who can use it"
        allowDeselect={false}
        disabled={disabled}
        data={(Object.keys(SEGMENT_LABEL) as (keyof typeof SEGMENT_LABEL)[]).map((s) => ({
          value: s,
          label: SEGMENT_LABEL[s],
        }))}
        value={v.segment}
        onChange={(s) => set({ segment: (s ?? 'all') as typeof v.segment })}
      />
      {v.segment === 'inactive_days' && (
        <NumberInput
          label="Days without an order"
          min={1}
          max={3650}
          allowDecimal={false}
          hideControls
          disabled={disabled}
          value={v.segmentParam}
          onChange={(n) => set({ segmentParam: typeof n === 'number' ? n : '' })}
        />
      )}
      {v.segment === 'specific' && (
        <Stack gap="xs">
          <CustomerSelect
            disabled={disabled}
            onPick={(c) =>
              !v.customers.some((x) => x.id === c.id) && set({ customers: [...v.customers, c] })
            }
          />
          {v.kind === 'code' && v.isBulk && (
            <Text size="xs" c="dimmed">
              Bulk codes can also be assigned to customers from the Codes tab, so this list may stay
              empty.
            </Text>
          )}
          <Group gap="xs">
            {v.customers.map((c) => (
              <Badge
                key={c.id}
                variant="light"
                size="lg"
                tt="none"
                rightSection={
                  disabled ? undefined : (
                    <CloseButton
                      size="xs"
                      aria-label={`Remove ${c.name}`}
                      onClick={() => set({ customers: v.customers.filter((x) => x.id !== c.id) })}
                    />
                  )
                }
              >
                {c.name}
                {c.phone ? ` - ${c.phone}` : ''}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}
      <Group grow align="flex-start">
        <MultiSelect
          label="Payment methods"
          description="Empty = any method. Only cash on delivery exists until online payments open."
          disabled={disabled}
          data={methods.map((m) => ({ value: m, label: m === 'cod' ? 'Cash on delivery' : m }))}
          value={v.paymentMethods}
          onChange={(m) => set({ paymentMethods: m })}
        />
        <Select
          label="Platform"
          allowDeselect={false}
          disabled={disabled}
          data={(Object.keys(PLATFORM_LABEL) as (keyof typeof PLATFORM_LABEL)[]).map((p) => ({
            value: p,
            label: PLATFORM_LABEL[p],
          }))}
          value={v.platform}
          onChange={(p) => set({ platform: (p ?? 'both') as typeof v.platform })}
        />
      </Group>
    </Section>
  );
}
