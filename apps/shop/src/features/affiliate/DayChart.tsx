import { dict, type Lang } from '~/i18n';
import { localizeDigits } from '~/lib/format';
import s from './affiliate.module.css';
import { maxOf } from './logic';
import type { AffiliateStats } from './types';

const W = 640;
const H = 180;
const PAD_B = 18;

/** Plain SVG bars: clicks (wide) with orders (narrow, on top) per day. No chart library. */
export function DayChart({ lang, days }: { lang: Lang; days: AffiliateStats['days'] }) {
  const t = dict(lang).affiliate.dash;
  const max = maxOf(days.flatMap((d) => [d.clicks, d.orders]));
  const slot = W / Math.max(1, days.length);
  const plotH = H - PAD_B;
  const bar = (v: number) => (v / max) * plotH;
  return (
    <div>
      <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.chartLabel}>
        {days.map((d, i) => {
          const x = i * slot;
          const [, m = '', day = ''] = d.date.split('-');
          return (
            <g key={d.date}>
              <title>
                {`${localizeDigits(`${Number(day)}/${Number(m)}`, lang)}: ${t.legendClicks} ${localizeDigits(d.clicks, lang)}, ${t.legendOrders} ${localizeDigits(d.orders, lang)}`}
              </title>
              <rect
                className={s.barClicks}
                x={x + slot * 0.12}
                y={plotH - bar(d.clicks)}
                width={slot * 0.76}
                height={bar(d.clicks)}
              />
              {d.orders > 0 ? (
                <rect
                  className={s.barOrders}
                  x={x + slot * 0.3}
                  y={plotH - bar(d.orders)}
                  width={slot * 0.4}
                  height={bar(d.orders)}
                />
              ) : null}
              {i % 5 === 0 ? (
                <text className={s.axis} x={x + slot / 2} y={H - 4} textAnchor="middle">
                  {localizeDigits(`${Number(day)}/${Number(m)}`, lang)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className={s.legend}>
        <span>
          <span className={`${s.dot} ${s.dotClicks}`} />
          {t.legendClicks}
        </span>
        <span>
          <span className={`${s.dot} ${s.dotOrders}`} />
          {t.legendOrders}
        </span>
      </div>
    </div>
  );
}
