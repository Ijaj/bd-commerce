'use client';
import { useState } from 'react';
import { EmptyState } from '~/components/States';
import { call } from '~/features/account/lib';
import { dict, fmt, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import { formatNumber, formatPrice } from '~/lib/format';
import s from './affiliate.module.css';
import { LoadBox } from './LoadBox';
import type { AffiliateMe, AffiliatePayouts } from './types';
import { PAGE_SIZE } from './types';
import { useLoad } from './useLoad';

export function PayoutsTab({ lang, me }: { lang: Lang; me: AffiliateMe }) {
  const t = dict(lang).affiliate;
  const [page, setPage] = useState(1);
  const list = useLoad<AffiliatePayouts>(
    () => call(browserApi.GET('/v1/customer/affiliate/payouts', { params: { query: { page } } })),
    `p${page}`,
  );
  const methods: Record<string, string> = t.pay.method;
  return (
    <div className={s.panel}>
      <p className={s.note}>
        {me.minPayoutP != null
          ? fmt(t.pay.note, { amt: formatPrice(me.minPayoutP, lang) })
          : t.pay.noteGeneric}
      </p>
      <section className={s.card} aria-labelledby="af-pay">
        <h2 id="af-pay">{t.tabs.pay}</h2>
        <LoadBox lang={lang} state={list.state} reload={list.reload}>
          {(d) => {
            if (d.items.length === 0) {
              return <EmptyState lang={lang} title={t.pay.empty} body={t.pay.emptyBody} />;
            }
            const pages = Math.max(1, Math.ceil(d.total / PAGE_SIZE));
            return (
              <>
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>{t.pay.colPeriod}</th>
                        <th className={s.num}>{t.pay.colAmount}</th>
                        <th>{t.pay.colMethod}</th>
                        <th>{t.pay.colReference}</th>
                        <th>{t.pay.colPaidOn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((p) => (
                        <tr key={p.id}>
                          <td>{p.period}</td>
                          <td className={s.num}>{formatPrice(p.amountP, lang)}</td>
                          <td>{methods[p.method] ?? p.method}</td>
                          <td>{p.reference}</td>
                          <td>
                            {new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
                              dateStyle: 'medium',
                              timeZone: 'Asia/Dhaka',
                            }).format(new Date(p.paidAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pages > 1 ? (
                  <nav className={s.pager} aria-label={t.tabs.pay}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      {t.dash.prev}
                    </button>
                    <span className={s.muted}>
                      {fmt(t.dash.pageOf, {
                        p: formatNumber(page, lang, 0),
                        n: formatNumber(pages, lang, 0),
                      })}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={page >= pages}
                      onClick={() => setPage(page + 1)}
                    >
                      {t.dash.next}
                    </button>
                  </nav>
                ) : null}
              </>
            );
          }}
        </LoadBox>
      </section>
    </div>
  );
}
