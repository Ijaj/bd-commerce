import {
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import { Section, type SectionProps } from './fields';
import { KIND_LABEL } from './logic';

export function IdentitySection({ v, set, disabled, locked, isNew, issues }: SectionProps) {
  const isCode = v.kind === 'code';
  return (
    <Section title="Identity" issues={issues}>
      <TextInput
        label="Name"
        description="Shown to customers on the cart and in their coupon wallet."
        required
        maxLength={120}
        disabled={disabled}
        value={v.name}
        onChange={(e) => set({ name: e.currentTarget.value })}
      />
      <Stack gap={4}>
        <Text size="sm">Kind</Text>
        <SegmentedControl
          disabled={disabled || !isNew}
          value={v.kind}
          onChange={(k) =>
            set({
              kind: k as 'code' | 'auto',
              ...(k === 'auto' ? { code: '', isBulk: false, isCollectable: false } : {}),
            })
          }
          data={[
            { value: 'code', label: KIND_LABEL.code },
            { value: 'auto', label: KIND_LABEL.auto },
          ]}
        />
        <Text size="xs" c="dimmed">
          {isCode
            ? 'The customer types a code (or collects the coupon) to get the discount.'
            : 'Applied automatically when the cart qualifies; no code needed.'}
          {!isNew && ' The kind cannot change after creation.'}
        </Text>
      </Stack>

      {isCode && (
        <>
          <Switch
            label="Bulk codes"
            description="Many unique one-time codes instead of one shared code. Generate them after saving."
            disabled={disabled || locked}
            checked={v.isBulk}
            onChange={(e) =>
              set({
                isBulk: e.currentTarget.checked,
                ...(e.currentTarget.checked ? { code: '', isCollectable: false } : {}),
              })
            }
          />
          {!v.isBulk && (
            <TextInput
              label="Code"
              description={
                locked
                  ? 'Locked: this coupon was already used in orders.'
                  : 'Letters, digits, - and _ (3 to 32). Not case sensitive.'
              }
              required
              maxLength={32}
              disabled={disabled || locked}
              value={v.code}
              onChange={(e) => set({ code: e.currentTarget.value.toUpperCase() })}
            />
          )}
        </>
      )}

      <Select
        label="Visibility"
        description="Public coupons are listed on the storefront offers page; hidden ones only work when the code is known."
        allowDeselect={false}
        disabled={disabled}
        data={[
          { value: 'public', label: 'Public' },
          { value: 'hidden', label: 'Hidden' },
        ]}
        value={v.visibility}
        onChange={(x) =>
          set({
            visibility: (x ?? 'public') as 'public' | 'hidden',
            ...(x === 'hidden' ? { isCollectable: false } : {}),
          })
        }
      />
      {isCode && !v.isBulk && (
        <Switch
          label="Collectable"
          description="Customers can add it to their wallet from the offers page. Needs public visibility."
          disabled={disabled || v.visibility !== 'public'}
          checked={v.isCollectable}
          onChange={(e) => set({ isCollectable: e.currentTarget.checked })}
        />
      )}
      {!isCode && (
        <NumberInput
          label="Priority"
          description="When several automatic coupons apply, higher priority is considered first."
          allowDecimal={false}
          min={-1000}
          max={1000}
          disabled={disabled}
          value={v.priority}
          onChange={(n) => set({ priority: typeof n === 'number' ? n : 0 })}
        />
      )}
      <BilingualTextInput
        label="Terms"
        description="Short conditions shown with the coupon (optional)."
        multiline
        rows={3}
        maxLength={2000}
        disabled={disabled}
        value={{ en: v.termsEn, bn: v.termsBn }}
        onChange={(t) => set({ termsEn: t.en, termsBn: t.bn })}
      />
    </Section>
  );
}
