'use client';
import { toEnDigits } from '@bdc/i18n';
import { useEffect, useState } from 'react';
import { dict, type Lang } from '~/i18n';
import { localizeDigits } from '~/lib/format';
import s from './cart.module.css';

/** - / number / + control. The number can be typed (Bangla digits too) and is committed on blur or Enter. */
export function QtyStepper({
  lang,
  qty,
  max,
  disabled,
  onChange,
  label,
}: {
  lang: Lang;
  qty: number;
  max: number;
  disabled?: boolean;
  onChange: (qty: number) => void;
  label: string;
}) {
  const d = dict(lang).cart;
  const [draft, setDraft] = useState(localizeDigits(qty, lang));
  useEffect(() => setDraft(localizeDigits(qty, lang)), [qty, lang]);

  function commit() {
    const n = Number.parseInt(toEnDigits(draft).replace(/\D/g, ''), 10);
    if (!Number.isFinite(n) || n < 1) {
      setDraft(localizeDigits(qty, lang));
      return;
    }
    const next = Math.min(n, Math.max(max, 1));
    setDraft(localizeDigits(next, lang));
    if (next !== qty) onChange(next);
  }

  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button
        type="button"
        aria-label={d.qtyDec}
        disabled={disabled || qty <= 1}
        onClick={() => onChange(qty - 1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        disabled={disabled}
        aria-label={d.qty}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        aria-label={d.qtyInc}
        title={qty >= max ? d.maxReached : undefined}
        disabled={disabled || qty >= max}
        onClick={() => onChange(qty + 1)}
      >
        +
      </button>
    </div>
  );
}
