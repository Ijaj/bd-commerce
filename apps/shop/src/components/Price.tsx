import type { Lang } from '~/i18n';
import { formatPrice, localizeDigits } from '~/lib/format';
import s from './Price.module.css';

/**
 * Price block: current price, struck-through old price and "-N%" badge (when compareAtP > priceP).
 * `size`: "md" (card, default), "lg" (product page).
 */
export function Price({
  lang,
  priceP,
  compareAtP,
  discountPct,
  size = 'md',
}: {
  lang: Lang;
  priceP: number;
  compareAtP?: number | null;
  discountPct?: number | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const onSale = compareAtP != null && compareAtP > priceP;
  return (
    <div className={`${s.row} ${s[size]}`}>
      <span className={s.price}>{formatPrice(priceP, lang)}</span>
      {onSale ? (
        <>
          <s className={s.old}>
            <span className="sr-only">{lang === 'bn' ? 'আগের দাম' : 'Was'} </span>
            {formatPrice(compareAtP, lang)}
          </s>
          {discountPct ? (
            <span className={s.off}>-{localizeDigits(discountPct, lang)}%</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
