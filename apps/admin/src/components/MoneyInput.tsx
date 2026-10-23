import { NumberInput, type NumberInputProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { takaToPaisa } from '~/lib/money';

const toText = (paisa: number | null | undefined) =>
  paisa === null || paisa === undefined ? '' : (paisa / 100).toFixed(2);

export interface MoneyInputProps
  extends Omit<NumberInputProps, 'value' | 'onChange' | 'defaultValue' | 'decimalScale'> {
  /** Integer paisa (12550 = ৳125.50), or null when empty. */
  value: number | null | undefined;
  /** Called with integer paisa, or null when the field is cleared. */
  onChange: (paisa: number | null) => void;
}

/**
 * Taka input with 2 decimals that reads/writes integer paisa.
 *   <MoneyInput label="Price" value={priceP} onChange={setPriceP} required />
 */
export function MoneyInput({ value, onChange, ...rest }: MoneyInputProps) {
  const [text, setText] = useState<string | number>(toText(value));

  // Re-sync when the parent changes the value from outside (form reset, loaded record).
  useEffect(() => {
    if (takaToPaisa(text) !== (value ?? null)) setText(toText(value));
  }, [value, text]);

  return (
    <NumberInput
      min={0}
      decimalScale={2}
      thousandSeparator=","
      prefix="৳"
      allowNegative={false}
      hideControls
      {...rest}
      value={text}
      onChange={(v) => {
        setText(v);
        onChange(takaToPaisa(v));
      }}
      onBlur={(e) => {
        setText(toText(takaToPaisa(text)));
        rest.onBlur?.(e);
      }}
    />
  );
}
