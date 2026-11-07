import { EmptyState } from '~/components/States';
import { dict, fmt, type Lang } from '~/i18n';
import { formatNumber, formatPrice } from '~/lib/format';
import s from './affiliate.module.css';
import type { AffiliateCommissions } from './types';
import { PAGE_SIZE } from './types';

function day(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(iso));
}

export function CommissionTable({
  lang,
  data,
  page,
  onPage,
}: {
  lang: Lang;
  data: AffiliateCommissions;
  page: number;
  onPage: (p: number) => void;
}) {
  const t = dict(lang).affiliate.dash;
  if (data.items.length === 0) {
    return <EmptyState lang={lang} title={t.empty} body={t.emptyBody} />;
  }
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const reasons: Record<string, string> = t.reverseReason;
  return (
    <>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t.colDate}</th>
              <th>{t.colItem}</th>
              <th>{t.colHow}</th>
              <th className={s.num}>{t.colBase}</th>
              <th className={s.num}>{t.colAmount}</th>
              <th>{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id}>
                <td>{day(c.placedAt, lang)}</td>
                <td>
                  {c.firstItemTitle ?? '-'}
                  {c.itemCount > 1 ? (
                    <div className={s.muted}>
                      {fmt(t.moreItems, { n: formatNumber(c.itemCount - 1, lang, 0) })}
                    </div>
                  ) : null}
                </td>
                <td>{t.via[c.attribution]}</td>
                <td className={s.num}>{formatPrice(c.baseP, lang)}</td>
                <td className={s.num}>{formatPrice(c.amountP, lang)}</td>
                <td>
                  <span className={`${s.badge} ${s[`st_${c.status}`] ?? ''}`}>
                    {t.status[c.status]}
                  </span>
                  {c.status === 'pending' && c.availableAt ? (
                    <div className={s.muted}>
                      {fmt(t.approvesOn, { date: day(c.availableAt, lang) })}
                    </div>
                  ) : null}
                  {c.status === 'reversed' && c.reverseReason ? (
                    <div className={s.muted}>{reasons[c.reverseReason] ?? ''}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className={s.pager} aria-label={t.commissionsTitle}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            {t.prev}
          </button>
          <span className={s.muted}>
            {fmt(t.pageOf, { p: formatNumber(page, lang, 0), n: formatNumber(pages, lang, 0) })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            {t.next}
          </button>
        </nav>
      ) : null}
    </>
  );
}
