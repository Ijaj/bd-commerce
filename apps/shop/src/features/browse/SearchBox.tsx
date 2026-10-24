'use client';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { type Lang, pick } from '~/i18n';
import { formatPrice } from '~/lib/format';
import s from './SearchBox.module.css';
import type { Suggest } from './types';

type Labels = {
  placeholder: string;
  search: string;
  suggestions: string;
  products: string;
  categories: string;
  brands: string;
  none: string;
  all: string; // "See all results for “{q}”"
};

type Row = { id: string; href: string; node: ReactNode };

const prefix = (lang: Lang) => (lang === 'bn' ? '/bn' : '');
const DEBOUNCE_MS = 200;

/**
 * Header search with autocomplete (combobox pattern). Works as a plain GET form without JS.
 * `className` is the header's form class; children (the submit button / icon) render inside the form.
 */
export function SearchBox({
  lang,
  labels,
  className,
  inputClassName,
  before,
  children,
}: {
  lang: Lang;
  labels: Labels;
  className?: string;
  inputClassName?: string;
  /** Rendered before the input (mobile search icon). */
  before?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [value, setValue] = useState('');
  const [data, setData] = useState<Suggest | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLFormElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setData(null);
      setOpen(false);
      return;
    }
    const ctl = new AbortController();
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/v1/public/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: ctl.signal,
        });
        if (!res.ok || mine !== seq.current) return;
        setData((await res.json()) as Suggest);
        setActive(-1);
        setOpen(true);
      } catch {
        // aborted or offline: keep the plain form working
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const base = prefix(lang);
  const rows: Row[] = [];
  const sections: { title: string; rows: Row[] }[] = [];
  if (data) {
    const mk = (title: string, list: Row[]) => {
      if (list.length) {
        sections.push({ title, rows: list });
        rows.push(...list);
      }
    };
    mk(
      labels.products,
      data.products.map((p) => ({
        id: `p-${p.slug}`,
        href: `${base}/p/${p.slug}`,
        node: (
          <>
            {p.image ? (
              // biome-ignore lint/performance/noImgElement: tiny imgproxy thumbnail
              <img src={p.image.url320} alt="" width={40} height={40} loading="lazy" />
            ) : (
              <span className={s.noimg} aria-hidden="true" />
            )}
            <span className={s.t}>{pick(lang, p.titleEn, p.titleBn)}</span>
            <span className={s.pr}>{formatPrice(p.priceP, lang)}</span>
          </>
        ),
      })),
    );
    mk(
      labels.categories,
      data.categories.map((c) => ({
        id: `c-${c.slug}`,
        href: `${base}/c/${c.slug}`,
        node: <span className={s.t}>{pick(lang, c.nameEn, c.nameBn)}</span>,
      })),
    );
    mk(
      labels.brands,
      data.brands.map((b) => ({
        id: `b-${b.slug}`,
        href: `${base}/search?brand=${encodeURIComponent(b.slug)}`,
        node: <span className={s.t}>{pick(lang, b.nameEn, b.nameBn)}</span>,
      })),
    );
  }
  const q = value.trim();
  const allRow: Row = {
    id: 'all',
    href: `${base}/search?q=${encodeURIComponent(q)}`,
    node: <span className={s.all}>{labels.all.replace('{q}', q)}</span>,
  };
  const all = [...rows, allRow];

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && data) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % all.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? all.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      setOpen(false);
      router.push(all[active]?.href ?? allRow.href);
    }
  };

  const expanded = open && data !== null;
  return (
    <form
      ref={wrap}
      className={`${className ?? ''} ${s.form}`}
      role="search"
      action={`${base}/search`}
      method="get"
    >
      {before}
      <input
        className={inputClassName}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => data && setOpen(true)}
        placeholder={labels.placeholder}
        aria-label={labels.search}
        autoComplete="off"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${id}-o${active}` : undefined}
      />
      {children}
      {expanded ? (
        <div className={s.panel}>
          <div id={listId} role="listbox" aria-label={labels.suggestions}>
            {rows.length === 0 ? <p className={s.none}>{labels.none}</p> : null}
            {(() => {
              let i = 0;
              return sections.map((sec) => (
                <div key={sec.title} role="group" aria-label={sec.title}>
                  <p className={s.sec} aria-hidden="true">
                    {sec.title}
                  </p>
                  {sec.rows.map((r) => {
                    const idx = i++;
                    return (
                      <div
                        key={r.id}
                        id={`${id}-o${idx}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={idx === active}
                        className={`${s.opt} ${idx === active ? s.on : ''}`}
                      >
                        <a href={r.href} onClick={() => setOpen(false)} tabIndex={-1}>
                          {r.node}
                        </a>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
            <div
              id={`${id}-o${rows.length}`}
              role="option"
              tabIndex={-1}
              aria-selected={active === rows.length}
              className={`${s.opt} ${active === rows.length ? s.on : ''}`}
            >
              <a href={allRow.href} onClick={() => setOpen(false)} tabIndex={-1}>
                {allRow.node}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
