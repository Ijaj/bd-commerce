'use client';
import { useRef } from 'react';

/** Sort dropdown as a GET form: submits on change with JS, has a button without it. */
export function SortSelect({
  action,
  hidden,
  value,
  options,
  label,
  apply,
  className,
}: {
  action: string;
  hidden: [string, string][];
  value: string;
  options: { value: string; label: string }[];
  label: string;
  apply: string;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} method="get" style={{ display: 'contents' }}>
      {hidden.map(([k, v]) => (
        <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
      ))}
      <label className={className}>
        <span>{label}</span>
        <select name="sort" defaultValue={value} onChange={() => form.current?.requestSubmit()}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="btn btn-sm btn-ghost">
          {apply}
        </button>
      </noscript>
    </form>
  );
}
