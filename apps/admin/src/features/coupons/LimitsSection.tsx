import { SimpleGrid, Stack, Switch } from '@mantine/core';
import { MoneyInput } from '~/components/MoneyInput';
import { OptInt, Section, type SectionProps } from './fields';

export function LimitsSection({ v, set, disabled, issues }: SectionProps) {
  return (
    <Section title="Limits" issues={issues}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <OptInt
          label="Total uses"
          description="Across all customers. Empty = unlimited."
          disabled={disabled}
          value={v.maxUsesTotal}
          onChange={(x) => set({ maxUsesTotal: x })}
        />
        <MoneyInput
          label="Budget"
          description="Stops when this much discount has been given. Empty = no cap."
          disabled={disabled}
          value={v.budgetCapP}
          onChange={(x) => set({ budgetCapP: x })}
        />
        <OptInt
          label="Uses per customer"
          disabled={disabled}
          value={v.maxPerCustomer}
          onChange={(x) => set({ maxPerCustomer: x })}
        />
        <OptInt
          label="Uses per phone number"
          description="Catches the same person with several accounts."
          disabled={disabled}
          value={v.maxPerPhone}
          onChange={(x) => set({ maxPerPhone: x })}
        />
        <OptInt
          label="Uses per device"
          disabled={disabled}
          value={v.maxPerDevice}
          onChange={(x) => set({ maxPerDevice: x })}
        />
      </SimpleGrid>
    </Section>
  );
}

export function StackingSection({ v, set, disabled, issues }: SectionProps) {
  return (
    <Section title="Stacking" issues={issues}>
      <Stack gap="sm">
        <Switch
          label="Works on items already on sale"
          description="Off: items with a sale or flash price are skipped by this coupon."
          disabled={disabled}
          checked={v.stacksWithSalePrice}
          onChange={(e) => set({ stacksWithSalePrice: e.currentTarget.checked })}
        />
        <Switch
          label="Can combine with other coupons"
          description="Two coupons apply to the same order only when both have this on. If not, only one of them is used."
          disabled={disabled}
          checked={v.stacksWithOtherCoupons}
          onChange={(e) => set({ stacksWithOtherCoupons: e.currentTarget.checked })}
        />
        <Switch
          label="Can combine with loyalty points"
          description="Whether points can be redeemed on the same order. Takes effect when loyalty points launch."
          disabled={disabled}
          checked={v.stacksWithPoints}
          onChange={(e) => set({ stacksWithPoints: e.currentTarget.checked })}
        />
      </Stack>
    </Section>
  );
}
