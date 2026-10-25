import { SectionCard } from '@bdc/ui';
import { NumberInput, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { MoneyInput } from '~/components/MoneyInput';
import classes from './ShippingTab.module.css';
import { type FormTabProps, numOrNull } from './tabProps';

export function ShippingTab({ form, set, disabled }: FormTabProps) {
  return (
    <Stack gap="md">
      <SectionCard title="Shipping">
        <div className={classes.grid3}>
          <NumberInput
            label="Weight (grams)"
            description="Default for variants without their own weight."
            min={0}
            allowDecimal={false}
            disabled={disabled}
            value={form.weightG ?? ''}
            onChange={(v) => set({ weightG: numOrNull(v) })}
          />
          <MoneyInput
            label="Delivery charge override"
            description="Replaces the zone charge for this product."
            disabled={disabled}
            value={form.deliveryChargeOverrideP}
            onChange={(v) => set({ deliveryChargeOverrideP: v })}
          />
          <NumberInput
            label="Return window (days)"
            description="Empty uses the category or shop default."
            min={0}
            max={365}
            allowDecimal={false}
            disabled={disabled}
            value={form.returnWindowDays ?? ''}
            onChange={(v) => set({ returnWindowDays: numOrNull(v) })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Availability">
        <Stack gap="sm">
          <Switch
            label="Pre-order"
            disabled={disabled}
            checked={form.isPreorder}
            onChange={(e) => set({ isPreorder: e.currentTarget.checked })}
          />
          {form.isPreorder && (
            <DateInput
              label="Expected date"
              placeholder="Pick a date"
              clearable
              disabled={disabled}
              value={form.preorderExpectedDate}
              onChange={(v) => set({ preorderExpectedDate: v })}
              maw={240}
            />
          )}
          <Switch
            label="Upcoming (visible, not yet orderable)"
            disabled={disabled}
            checked={form.isUpcoming}
            onChange={(e) => set({ isUpcoming: e.currentTarget.checked })}
          />
          <NumberInput
            label="Advance payment (%)"
            description="Share of the price collected up front. Empty = full payment."
            min={1}
            max={100}
            allowDecimal={false}
            disabled={disabled}
            value={form.advancePercent ?? ''}
            onChange={(v) => set({ advancePercent: numOrNull(v) })}
            maw={240}
          />
        </Stack>
      </SectionCard>

      <SectionCard title="Placement">
        <Stack gap="sm">
          <Switch
            label="Pinned"
            disabled={disabled}
            checked={form.isPinned}
            onChange={(e) => set({ isPinned: e.currentTarget.checked })}
          />
          {form.isPinned && (
            <NumberInput
              label="Pin boost"
              description="Higher shows earlier (0-1000)."
              min={0}
              max={1000}
              allowDecimal={false}
              disabled={disabled}
              value={form.pinBoost}
              onChange={(v) => set({ pinBoost: numOrNull(v) ?? 0 })}
              maw={240}
            />
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="SEO">
        <Stack gap="sm">
          <TextInput
            label="SEO title"
            maxLength={250}
            disabled={disabled}
            value={form.seoTitle}
            onChange={(e) => set({ seoTitle: e.currentTarget.value })}
          />
          <Textarea
            label="SEO description"
            autosize
            minRows={2}
            maxLength={500}
            disabled={disabled}
            value={form.seoDescription}
            onChange={(e) => set({ seoDescription: e.currentTarget.value })}
          />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
