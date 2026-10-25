import { dict, fmt, type Lang } from '~/i18n';
import { formatPrice } from '~/lib/format';
import s from './promotions.module.css';

export type DiscountRow = {
  name: string;
  code: string | null;
  amountP: number;
  freeDelivery: boolean;
};

/** "Discounts" list for an order: each offer or coupon that applied and what it saved. */
export function DiscountList({ rows, lang }: { rows: DiscountRow[]; lang: Lang }) {
  if (rows.length === 0) return null;
  const t = dict(lang).promos.order;
  return (
    <section className={s.discounts} aria-label={t.discounts}>
      <h3 className={s.discountsTitle}>{t.discounts}</h3>
      <ul className={s.discountList}>
        {rows.map((r) => (
          <li key={`${r.name}-${r.code ?? ''}`} className={s.discountRow}>
            <span>
              {r.name}
              {r.code ? <span className={s.facts}> · {fmt(t.code, { code: r.code })}</span> : null}
              {r.freeDelivery ? <span className={s.facts}> · {t.delivery}</span> : null}
            </span>
            {r.amountP > 0 ? (
              <span className={s.saved}>−{formatPrice(r.amountP, lang)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
