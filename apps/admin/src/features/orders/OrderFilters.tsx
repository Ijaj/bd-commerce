import { Button, Group, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import type { CallStatus, OrderFilters as Filters, OrderStatus, PaymentStatus } from './api';
import { CALL_OPTIONS, PAYMENT_OPTIONS, STATUS_OPTIONS } from './logic';

export type FilterState = Omit<Filters, 'page' | 'pageSize'>;

/** Filter bar; the search box is debounced so typing does not fire a request per key. */
export function OrderFilterBar({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const [text, setText] = useState(value.q ?? '');
  const [debounced] = useDebouncedValue(text, 300);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to the debounced text
  useEffect(() => {
    const q = debounced.trim() || undefined;
    if (q !== value.q) onChange({ ...value, q });
  }, [debounced]);

  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });
  const dirty = Object.values(value).some((v) => v !== undefined);

  return (
    <Group gap="xs" mb="sm" align="flex-end">
      <TextInput
        label="Search"
        placeholder="Order no, phone or name"
        w={220}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      <Select
        label="Status"
        placeholder="Any"
        w={160}
        clearable
        data={STATUS_OPTIONS}
        value={value.status ?? null}
        onChange={(v) => set({ status: (v as OrderStatus | null) ?? undefined })}
      />
      <Select
        label="Payment"
        placeholder="Any"
        w={160}
        clearable
        data={PAYMENT_OPTIONS}
        value={value.paymentStatus ?? null}
        onChange={(v) => set({ paymentStatus: (v as PaymentStatus | null) ?? undefined })}
      />
      <Select
        label="Call"
        placeholder="Any"
        w={160}
        clearable
        data={CALL_OPTIONS}
        value={value.call ?? null}
        onChange={(v) => set({ call: (v as CallStatus | null) ?? undefined })}
      />
      <Select
        label="Risk"
        placeholder="Any"
        w={130}
        clearable
        data={[
          { value: '1', label: 'Flagged' },
          { value: '0', label: 'Not flagged' },
        ]}
        value={value.risk ?? null}
        onChange={(v) => set({ risk: (v as '0' | '1' | null) ?? undefined })}
      />
      <TextInput
        label="From"
        type="date"
        w={150}
        value={value.from ?? ''}
        onChange={(e) => set({ from: e.currentTarget.value || undefined })}
      />
      <TextInput
        label="To"
        type="date"
        w={150}
        value={value.to ?? ''}
        onChange={(e) => set({ to: e.currentTarget.value || undefined })}
      />
      {dirty && (
        <Button
          variant="subtle"
          onClick={() => {
            setText('');
            onChange({});
          }}
        >
          Clear
        </Button>
      )}
    </Group>
  );
}
