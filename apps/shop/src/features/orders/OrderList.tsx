import Link from 'next/link';
import { Img } from '~/components/Img';
import { EmptyState } from '~/components/States';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice, localizeDigits } from '~/lib/format';
import { formatDateTime } from './format';
import s from './orders.module.css';
import type { OrderList as OrderListData } from './types';

export function OrderList({
  lang,
  data,
  basePath,
}: {
  lang: Lang;
  data: OrderListData;
  basePath: string;
}) {
  const d = dict(lang).orders;
  if (data.items.length === 0) {
    return (
      <EmptyState
        lang={lang}
        title={d.listEmpty}
        body={d.listEmptyBody}
        action={
          <Link className="btn btn-primary" href={href(lang, '/')}>
            {d.startShopping}
          </Link>
        }
      />
    );
  }
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  return (
    <>
      <ul className={s.list}>
        {data.items.map((o) => (
          <li key={o.orderNo}>
            <Link className={s.orderRow} href={href(lang, `${basePath}/${o.orderNo}`)}>
              <span className={s.thumb}>
                <Img image={o.firstImage} sizes="64px" alt="" />
              </span>
              <span className={s.orderText}>
                <span>{localizeDigits(o.orderNo, lang)}</span>
                <span className={s.muted}>
                  {fmt(d.placedOn, { date: formatDateTime(o.placedAt, lang) })}
                </span>
                <span className={s.muted}>
                  {o.itemCount === 1
                    ? d.item1
                    : fmt(d.itemsN, { n: localizeDigits(o.itemCount, lang) })}
                </span>
              </span>
              <span className={s.orderSide}>
                <span className={`${s.badge} ${s[`st_${o.status}`] ?? ''}`}>
                  {d.status[o.status]}
                </span>
                <span>{formatPrice(o.grandTotalP, lang)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav className={s.pager} aria-label={d.listTitle}>
          {data.page > 1 ? (
            <Link
              className="btn btn-ghost btn-sm"
              href={`${href(lang, basePath)}?page=${data.page - 1}`}
            >
              {d.prev}
            </Link>
          ) : (
            <span />
          )}
          <span className={s.muted}>
            {fmt(d.pageOf, { p: localizeDigits(data.page, lang), n: localizeDigits(pages, lang) })}
          </span>
          {data.page < pages ? (
            <Link
              className="btn btn-ghost btn-sm"
              href={`${href(lang, basePath)}?page=${data.page + 1}`}
            >
              {d.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
