'use client';
import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';
import { dict, type Lang } from '~/i18n';
import s from './account.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  /** Keep the label for assistive tech only (the surrounding heading already says it). */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | null;
};

/** Labelled input with hint + inline error, wired with aria-describedby / aria-invalid. */
export function Field({ label, hideLabel, hint, error, className, ...input }: Props) {
  const id = useId();
  const hintId = `${id}-h`;
  const errId = `${id}-e`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ');
  return (
    <div className={s.field}>
      <label className={hideLabel ? `${s.label} sr-only` : s.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        className={`input ${error ? s.invalid : ''} ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {hint ? (
        <span id={hintId} className={s.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errId} className={s.fieldErr}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle (helps on phones). */
export function PasswordField({
  lang,
  label,
  hint,
  error,
  ...input
}: Omit<Props, 'type'> & { lang: Lang }) {
  const [shown, setShown] = useState(false);
  const d = dict(lang).account;
  const id = useId();
  const hintId = `${id}-h`;
  const errId = `${id}-e`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ');
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <div className={s.pw}>
        <input
          {...input}
          id={id}
          type={shown ? 'text' : 'password'}
          className={`input ${error ? s.invalid : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        <button
          type="button"
          className={s.pwToggle}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
        >
          {shown ? d.hidePassword : d.showPassword}
        </button>
      </div>
      {hint ? (
        <span id={hintId} className={s.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errId} className={s.fieldErr}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Form-level error / success message (announced to screen readers). */
export function Notice({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div className={kind === 'error' ? s.alert : s.ok} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
