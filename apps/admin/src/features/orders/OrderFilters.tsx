import { Toolbar } from '@bdc/ui';
import { Button, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import type { CallStatus, OrderFilters as Filters, OrderStatus, PaymentStatus } from './api';
import { CALL_OPTIONS, PAYMENT_OPTIONS, STATUS_OPTIONS } from './logic';
import classes from './Orders.module.css';

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
    <>
      <div className={classes.tabsWrap}>
        <div className="a-tabs" role="tablist" aria-label="Order status">
          <button
            type="button"
            role="tab"
            className="a-tab"
            aria-selected={value.status === undefined}
            onClick={() => set({ status: undefined })}
          >
            All
          </button>
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="tab"
              className="a-tab"
              aria-selected={value.status === o.value}
              onClick={() => set({ status: o.value as OrderStatus })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <Toolbar>
        <TextInput
          className="grow"
          aria-label="Search"
          placeholder="Search order no, phone or name"
          miw={200}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        <span className={classes.fromTo}>
          From
          <TextInput
            type="date"
            aria-label="From date"
            w={150}
            value={value.from ?? ''}
            onChange={(e) => set({ from: e.currentTarget.value || undefined })}
          />
        </span>
        <span className={classes.fromTo}>
          To
          <TextInput
            type="date"
            aria-label="To date"
            w={150}
            value={value.to ?? ''}
            onChange={(e) => set({ to: e.currentTarget.value || undefined })}
          />
        </span>
      </Toolbar>
      <div className={classes.toolbar2}>
        <Select
          aria-label="Payment"
          placeholder="Payment status: all"
          w={190}
          clearable
          data={PAYMENT_OPTIONS}
          value={value.paymentStatus ?? null}
          onChange={(v) => set({ paymentStatus: (v as PaymentStatus | null) ?? undefined })}
        />
        <Select
          aria-label="Call"
          placeholder="Call: all"
          w={160}
          clearable
          data={CALL_OPTIONS}
          value={value.call ?? null}
          onChange={(v) => set({ call: (v as CallStatus | null) ?? undefined })}
        />
        <Select
          aria-label="Risk"
          placeholder="Risk: all"
          w={150}
          clearable
          data={[
            { value: '1', label: 'Flagged' },
            { value: '0', label: 'Not flagged' },
          ]}
          value={value.risk ?? null}
          onChange={(v) => set({ risk: (v as '0' | '1' | null) ?? undefined })}
        />
        {dirty && (
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              setText('');
              onChange({});
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
    </>
  );
}
