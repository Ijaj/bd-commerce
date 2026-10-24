import Link from 'next/link';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { localizeDigits } from '~/lib/format';
import s from './Listing.module.css';
import { type ListingQuery, toSearch } from './query';

/** Numbered links (crawlable, no JS). Window of pages around the current one plus first/last. */
export function Pagination({
  lang,
  path,
  q,
  page,
  pages,
  label,
}: {
  lang: Lang;
  path: string;
  q: ListingQuery;
  page: number;
  pages: number;
  label: string;
}) {
  const d = dict(lang).browse;
  const to = (n: number) => `${href(lang, path)}${toSearch(q, { page: n })}`;
  const nums = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  nums.forEach((n, i) => {
    const prev = nums[i - 1];
    if (prev !== undefined && n - prev > 1) items.push('gap');
    items.push(n);
  });
  return (
    <nav className={s.pager} aria-label={label}>
      {page > 1 ? (
        <Link className={s.pg} href={to(page - 1)} rel="prev">
          {d.prev}
        </Link>
      ) : null}
      {items.map((n, i) =>
        n === 'gap' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static separators
          <span key={`g${i}`} className={s.gap} aria-hidden="true">
            …
          </span>
        ) : n === page ? (
          <span key={n} className={`${s.pg} ${s.cur}`} aria-current="page">
            {localizeDigits(n, lang)}
          </span>
        ) : (
          <Link
            key={n}
            className={s.pg}
            href={to(n)}
            aria-label={fmt(d.page, { n: localizeDigits(n, lang) })}
          >
            {localizeDigits(n, lang)}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link className={s.pg} href={to(page + 1)} rel="next">
          {d.next}
        </Link>
      ) : null}
    </nav>
  );
}
