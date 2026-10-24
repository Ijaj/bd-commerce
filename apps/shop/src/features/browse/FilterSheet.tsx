'use client';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '~/components/Icon';
import { FilterIcon } from './icons';
import s from './Listing.module.css';

/**
 * Layout shell of a listing page: filter sidebar (desktop) or bottom sheet (<= 1023px) next to the
 * results. The filters are a plain GET form rendered on the server (works without JS); this client
 * part only toggles the sheet and auto-submits on desktop when a control changes.
 */
export function FilterSheet({
  filters,
  bar,
  children,
  activeCount,
  labels,
}: {
  filters: ReactNode;
  bar: ReactNode;
  children: ReactNode;
  activeCount: number;
  labels: { filter: string; filters: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    asideRef.current?.querySelector<HTMLElement>('button, input, a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div className={s.layout}>
      <div className={`${s.back} ${open ? s.backOpen : ''}`} onClick={close} aria-hidden="true" />
      <aside
        ref={asideRef}
        className={`${s.filters} ${open ? s.sheetOpen : ''}`}
        aria-label={labels.filters}
        {...(open ? { role: 'dialog', 'aria-modal': true } : {})}
        onChange={(e) => {
          // desktop: apply on change; the sheet waits for its "Show results" button
          if (window.matchMedia('(min-width: 1024px)').matches) {
            (e.target as HTMLElement).closest('form')?.requestSubmit();
          }
        }}
      >
        <div className={s.sheetHead}>
          <h2>{labels.filters}</h2>
          <button type="button" className={s.iconBtn} onClick={close} aria-label={labels.close}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {filters}
      </aside>
      <section className={s.main}>
        <div className={s.bar}>
          <button
            ref={openerRef}
            type="button"
            className={`btn btn-ghost ${s.filterBtn}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <FilterIcon />
            <span>{labels.filter}</span>
            {activeCount > 0 ? <span className={s.fc}>{activeCount}</span> : null}
          </button>
          {bar}
        </div>
        {children}
      </section>
    </div>
  );
}
