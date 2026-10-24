'use client';
import { type ReactNode, type SelectHTMLAttributes, useId } from 'react';
import s from '~/features/account/account.module.css';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  error?: string | null;
  placeholder: string;
  options: { value: number; label: string }[];
  hint?: ReactNode;
};

/** Labelled native select (best on low-end phones) with an inline error. */
export function SelectField({ label, error, placeholder, options, hint, ...select }: Props) {
  const id = useId();
  const errId = `${id}-e`;
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <select
        {...select}
        id={id}
        className={`input ${error ? s.invalid : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className={s.hint}>{hint}</span> : null}
      {error ? (
        <span id={errId} className={s.fieldErr}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
