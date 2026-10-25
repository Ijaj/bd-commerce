import { SectionCard } from '@bdc/ui';
import { Alert, NumberInput, type NumberInputProps } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './Coupons.module.css';
import type { CouponFormValues } from './form';

/** Props every editor section gets. `disabled` = read-only (no coupons.manage). */
export interface SectionProps {
  v: CouponFormValues;
  set: (patch: Partial<CouponFormValues>) => void;
  disabled: boolean;
  /** Redeemed already: type, code and bulk mode are frozen. */
  locked: boolean;
  isNew: boolean;
  issues: string[];
}

export function Section({
  title,
  issues,
  children,
}: {
  title: string;
  issues: string[];
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} bodyClassName={classes.sectionBody}>
      {issues.length > 0 && (
        <Alert color="red" variant="light" title="Fix this section">
          {issues.map((i) => (
            <div key={i}>{i}</div>
          ))}
        </Alert>
      )}
      {children}
    </SectionCard>
  );
}

type OptIntProps = Omit<NumberInputProps, 'value' | 'onChange'> & {
  value: number | null;
  onChange: (v: number | null) => void;
};

/** Whole-number input where empty means "no limit" (null). */
export function OptInt({ value, onChange, ...rest }: OptIntProps) {
  return (
    <NumberInput
      min={1}
      allowDecimal={false}
      allowNegative={false}
      hideControls
      {...rest}
      value={value ?? ''}
      onChange={(n) => onChange(typeof n === 'number' ? n : null)}
    />
  );
}
