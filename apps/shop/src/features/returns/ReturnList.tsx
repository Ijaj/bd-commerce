import Link from 'next/link';
import { EmptyState } from '~/components/States';
import { formatDateTime } from '~/features/orders/format';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { localizeDigits } from '~/lib/format';
import s from './returns.module.css';
import type { CustomerReturnList } from './types';

export function ReturnList({ lang, data }: { lang: Lang; data: CustomerReturnList }) {
  const d = dict(lang).returns;
  if (data.items.length === 0) {
    return (
      <EmptyState
        lang={lang}
        title={d.listEmpty}
        body={d.listEmptyBody}
        action={
          <Link className="btn btn-primary" href={href(lang, '/account/orders')}>
            {d.viewOrders}
          </Link>
        }
      />
    );
  }
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  return (
    <>
      <ul className={s.list}>
        {data.items.map((r) => {
          const n = r.items.reduce((sum, i) => sum + i.qty, 0);
          return (
            <li key={r.returnNo}>
              <Link className={s.row} href={href(lang, `/account/returns/${r.returnNo}`)}>
                <span className={s.rowText}>
                  <span>{localizeDigits(r.returnNo, lang)}</span>
                  <span className={s.muted}>
                    {fmt(d.forOrder, { no: localizeDigits(r.orderNo, lang) })} ·{' '}
                    {n === 1 ? d.item1 : fmt(d.itemsN, { n: localizeDigits(n, lang) })}
                  </span>
                  <span className={s.muted}>
                    {fmt(d.requestedOn, { date: formatDateTime(r.requestedAt, lang) })}
                  </span>
                </span>
                <span className={`${s.badge} ${s[`st_${r.status}`] ?? ''}`}>
                  {d.status[r.status]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {pages > 1 ? (
        <nav className={s.pager} aria-label={d.listTitle}>
          {data.page > 1 ? (
            <Link
              className="btn btn-ghost btn-sm"
              href={`${href(lang, '/account/returns')}?page=${data.page - 1}`}
            >
              {dict(lang).orders.prev}
            </Link>
          ) : (
            <span />
          )}
          <span className={s.muted}>
            {fmt(dict(lang).orders.pageOf, {
              p: localizeDigits(data.page, lang),
              n: localizeDigits(pages, lang),
            })}
          </span>
          {data.page < pages ? (
            <Link
              className="btn btn-ghost btn-sm"
              href={`${href(lang, '/account/returns')}?page=${data.page + 1}`}
            >
              {dict(lang).orders.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
