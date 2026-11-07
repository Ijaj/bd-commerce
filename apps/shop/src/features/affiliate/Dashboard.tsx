'use client';
import { useState } from 'react';
import { call } from '~/features/account/lib';
import { dict, fmt, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import { formatNumber, formatPrice } from '~/lib/format';
import s from './affiliate.module.css';
import { CommissionTable } from './CommissionTable';
import { DayChart } from './DayChart';
import { LoadBox } from './LoadBox';
import { bpToPercent, conversionText } from './logic';
import type { AffiliateCommissions, AffiliateMe, AffiliateStats } from './types';
import { PAGE_SIZE } from './types';
import { useLoad } from './useLoad';

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
      {hint ? <div className={s.statHint}>{hint}</div> : null}
    </div>
  );
}

export function Dashboard({ lang, me }: { lang: Lang; me: AffiliateMe }) {
  const t = dict(lang).affiliate.dash;
  const [page, setPage] = useState(1);
  const stats = useLoad<AffiliateStats>(
    () => call(browserApi.GET('/v1/customer/affiliate/stats', { params: { query: { days: 30 } } })),
    'stats',
  );
  const list = useLoad<AffiliateCommissions>(
    () =>
      call(
        browserApi.GET('/v1/customer/affiliate/commissions', {
          params: { query: { page, pageSize: PAGE_SIZE } },
        }),
      ),
    `c${page}`,
  );
  return (
    <div className={s.panel}>
      <LoadBox lang={lang} state={stats.state} reload={stats.reload}>
        {(d) => (
          <>
            <div className={s.stats}>
              <StatTile label={t.clicks} value={formatNumber(d.totals.clicks, lang)} />
              <StatTile label={t.orders} value={formatNumber(d.totals.orders, lang)} />
              <StatTile
                label={t.conversion}
                value={`${formatNumber(Number(conversionText(d.totals.conversionBp)), lang, 1)}%`}
              />
              <StatTile
                label={t.pending}
                value={formatPrice(d.totals.pendingP, lang)}
                hint={t.pendingHint}
              />
              <StatTile
                label={t.balance}
                value={formatPrice(d.totals.balanceP, lang)}
                hint={t.balanceHint}
              />
              <StatTile label={t.paid} value={formatPrice(d.totals.paidP, lang)} />
            </div>
            <p className={s.note}>
              {fmt(t.note, {
                code: me.code ?? '',
                rate: formatNumber(Number(bpToPercent(me.commissionBp ?? 0)), lang, 1),
                days: formatNumber(me.clickWindowDays ?? 30, lang, 0),
              })}
            </p>
            <section className={s.card} aria-labelledby="af-chart">
              <h2 id="af-chart">{t.chartTitle}</h2>
              <DayChart lang={lang} days={d.days} />
            </section>
          </>
        )}
      </LoadBox>
      <section className={s.card} aria-labelledby="af-comm">
        <h2 id="af-comm">{t.commissionsTitle}</h2>
        <LoadBox lang={lang} state={list.state} reload={list.reload}>
          {(d) => <CommissionTable lang={lang} data={d} page={page} onPage={setPage} />}
        </LoadBox>
      </section>
    </div>
  );
}
