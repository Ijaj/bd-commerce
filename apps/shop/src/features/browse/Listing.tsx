import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '~/components/Icon';
import { ProductGrid } from '~/components/ProductGrid';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import { dict, fmt, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatNumber, localizeDigits } from '~/lib/format';
import { FilterSheet } from './FilterSheet';
import s from './Listing.module.css';
import { Pagination } from './Pagination';
import { type ListingQuery, toSearch } from './query';
import { SortSelect } from './SortSelect';
import { AVAILABILITY, type Listing as ListingData, SORTS } from './types';

const RATINGS = [0, 4, 3];

function Group({
  title,
  open = true,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={s.group} open={open}>
      <summary>{title}</summary>
      <div className={s.groupBody}>{children}</div>
    </details>
  );
}

function Check({
  name,
  value,
  checked,
  label,
  count,
  type = 'checkbox',
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  count?: number;
  type?: 'checkbox' | 'radio';
}) {
  return (
    <label className={s.opt}>
      <input type={type} name={name} value={value} defaultChecked={checked} />
      <span className={s.optLabel}>{label}</span>
      {count !== undefined ? <em className={s.optCount}>{formatNumber(count, 'en')}</em> : null}
    </label>
  );
}

type Pill = { label: string; to: string };

function buildPills(lang: Lang, path: string, q: ListingQuery, data: ListingData): Pill[] {
  const d = dict(lang).browse;
  const at = (over: Partial<ListingQuery>) => `${href(lang, path)}${toSearch(q, over)}`;
  const pills: Pill[] = [];
  if (q.min !== null || q.max !== null) {
    const lo = q.min !== null ? `৳${localizeDigits(q.min, lang)}` : '';
    const hi = q.max ? `৳${localizeDigits(q.max, lang)}` : '';
    pills.push({
      label: `${d.price.replace(' (৳)', '')}: ${lo || '৳0'} - ${hi || '∞'}`,
      to: at({ min: null, max: null }),
    });
  }
  for (const b of q.brand) {
    const f = data.facets.brands.find((x) => x.slug === b);
    pills.push({
      label: `${d.brand}: ${f ? pick(lang, f.nameEn, f.nameBn) : b}`,
      to: at({ brand: q.brand.filter((x) => x !== b) }),
    });
  }
  if (q.rating) {
    pills.push({
      label: `★ ${fmt(d.ratingUp, { n: localizeDigits(q.rating, lang) })}`,
      to: at({ rating: null }),
    });
  }
  const avl: Record<string, string> = {
    in_stock: d.inStock,
    preorder: d.preorder,
    upcoming: d.upcoming,
  };
  for (const a of q.availability) {
    pills.push({
      label: `${d.availability}: ${avl[a]}`,
      to: at({ availability: q.availability.filter((x) => x !== a) }),
    });
  }
  for (const [key, ids] of Object.entries(q.attrs)) {
    const fac = data.facets.attributes.find((x) => x.key === key);
    for (const id of ids) {
      const o = fac?.options.find((x) => x.id === id);
      const rest = { ...q.attrs, [key]: ids.filter((x) => x !== id) };
      if (!rest[key]?.length) delete rest[key];
      pills.push({
        label: `${fac ? pick(lang, fac.nameEn, fac.nameBn) : key}: ${o ? pick(lang, o.valueEn, o.valueBn) : id}`,
        to: at({ attrs: rest }),
      });
    }
  }
  return pills;
}

/**
 * Shared body of the category and search pages: filters (URL-driven GET form), sort, active-filter
 * pills, product grid and crawlable pagination. `path` is the language-less page path.
 */
export function Listing({
  lang,
  path,
  q,
  data,
  hiddenQ = false,
}: {
  lang: Lang;
  path: string;
  q: ListingQuery;
  data: ListingData;
  /** Search page: keep `q` as a hidden field of the filter form. */
  hiddenQ?: boolean;
}) {
  const d = dict(lang).browse;
  const action = href(lang, path);
  const { facets } = data;
  const pills = buildPills(lang, path, q, data);
  const showBrands = facets.brands.length > 1 || q.brand.length > 0;
  const availLabel = { in_stock: d.inStock, preorder: d.preorder, upcoming: d.upcoming };
  const hiddenFields: [string, string][] = [];
  if (hiddenQ && q.q) hiddenFields.push(['q', q.q]);
  const sortHidden = [...new URLSearchParams(toSearch(q, { sort: null }))].filter(
    ([k]) => k !== 'page',
  );
  const sortValue = q.sort ?? (q.q ? 'relevance' : 'popular');
  const sortOptions = SORTS.filter((k) => (k === 'relevance' ? !!q.q : true)).map((k) => ({
    value: k,
    label: d.sorts[k],
  }));
  const countText =
    data.total === 1 ? d.result1 : fmt(d.results, { n: localizeDigits(data.total, lang) });
  const clearHref = `${action}${toSearch({
    ...q,
    brand: [],
    min: null,
    max: null,
    rating: null,
    availability: [],
    attrs: {},
  })}`;
  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  const filters = (
    <form className={s.fform} action={action} method="get">
      {hiddenFields.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {q.sort ? <input type="hidden" name="sort" value={q.sort} /> : null}
      <div className={s.fbody}>
        <Group title={d.availability}>
          {AVAILABILITY.map((a) => (
            <Check
              key={a}
              name="availability"
              value={a}
              checked={q.availability.includes(a)}
              label={availLabel[a]}
              count={facets.availability[a]}
            />
          ))}
        </Group>
        <Group title={d.price}>
          <div className={s.prow}>
            <label>
              <span className="sr-only">{d.min}</span>
              <input
                className="input"
                type="number"
                name="min"
                inputMode="numeric"
                min={0}
                placeholder={facets.price ? String(Math.floor(facets.price.min / 100)) : d.min}
                defaultValue={q.min ?? ''}
              />
            </label>
            <span aria-hidden="true">-</span>
            <label>
              <span className="sr-only">{d.max}</span>
              <input
                className="input"
                type="number"
                name="max"
                inputMode="numeric"
                min={0}
                placeholder={facets.price ? String(Math.ceil(facets.price.max / 100)) : d.max}
                defaultValue={q.max ?? ''}
              />
            </label>
            <button className="btn btn-sm btn-ghost" type="submit">
              {d.apply}
            </button>
          </div>
        </Group>
        {showBrands ? (
          <Group title={d.brand}>
            {facets.brands.map((b) => (
              <Check
                key={b.slug}
                name="brand"
                value={b.slug}
                checked={q.brand.includes(b.slug)}
                label={pick(lang, b.nameEn, b.nameBn)}
                count={b.count}
              />
            ))}
          </Group>
        ) : null}
        <Group title={d.rating}>
          {RATINGS.map((n) => (
            <Check
              key={n}
              type="radio"
              name="rating"
              value={String(n)}
              checked={(q.rating ?? 0) === n}
              label={n === 0 ? d.anyRating : `★ ${fmt(d.ratingUp, { n: localizeDigits(n, lang) })}`}
            />
          ))}
        </Group>
        {facets.attributes.map((a) => (
          <Group
            key={a.key}
            title={pick(lang, a.nameEn, a.nameBn) + (a.unit ? ` (${a.unit})` : '')}
            open={!!q.attrs[a.key]?.length}
          >
            {a.options.map((o) => (
              <Check
                key={o.id}
                name={`attr.${a.key}`}
                value={o.id}
                checked={q.attrs[a.key]?.includes(o.id) ?? false}
                label={pick(lang, o.valueEn, o.valueBn)}
                count={o.count}
              />
            ))}
          </Group>
        ))}
      </div>
      <div className={s.ffoot}>
        {pills.length > 0 ? (
          <Link className="btn btn-ghost" href={clearHref}>
            {d.clearAll}
          </Link>
        ) : null}
        <button className={`btn btn-primary ${s.showBtn}`} type="submit">
          {fmt(d.showResults, { n: localizeDigits(data.total, lang) })}
        </button>
      </div>
    </form>
  );

  return (
    <FilterSheet
      filters={filters}
      activeCount={pills.length}
      labels={{ filter: d.filter, filters: d.filters, close: d.close }}
      bar={
        <>
          <p className={s.count} aria-live="polite">
            {countText}
          </p>
          <SortSelect
            className={s.sort}
            action={action}
            hidden={sortHidden}
            value={sortValue}
            options={sortOptions}
            label={d.sortBy}
            apply={d.apply}
          />
        </>
      }
    >
      {pills.length > 0 ? (
        <ul className={s.pills} aria-label={d.activeFilters}>
          {pills.map((p) => (
            <li key={p.to}>
              <Link className={s.pill} href={p.to} rel="nofollow">
                {p.label}
                <Icon name="close" size={13} />
                <span className="sr-only">{d.removeFilter}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link className={s.clear} href={clearHref} rel="nofollow">
              {d.clearAll}
            </Link>
          </li>
        </ul>
      ) : null}
      {data.items.length > 0 ? (
        <>
          <ProductGrid
            products={data.items}
            lang={lang}
            compact
            priorityCount={4}
            renderHeart={(p) => <WishlistHeart productId={p.id} lang={lang} />}
          />
          {pages > 1 ? (
            <Pagination
              lang={lang}
              path={path}
              q={q}
              page={data.page}
              pages={pages}
              label={d.pagination}
            />
          ) : null}
        </>
      ) : (
        <div className={s.empty}>
          <h2>{pills.length > 0 || !q.q ? d.noMatch : d.noResults}</h2>
          <p>{pills.length > 0 || !q.q ? d.noMatchBody : d.noResultsBody}</p>
        </div>
      )}
    </FilterSheet>
  );
}
