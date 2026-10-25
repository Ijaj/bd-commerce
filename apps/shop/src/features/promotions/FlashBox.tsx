import { dict, fmt, type Lang } from '~/i18n';
import { localizeDigits } from '~/lib/format';
import { Countdown } from './Countdown';
import { lowFlash } from './logic';
import s from './promotions.module.css';

/** Product page: the selected variant's flash price info (countdown, scarcity, personal limit). */
export function FlashBox({
  flash,
  lang,
}: {
  flash: { endsAt: string; remaining: number; perCustomerLimit: number | null };
  lang: Lang;
}) {
  const t = dict(lang).promos.flash;
  return (
    <div className={s.flashBox}>
      <p className={s.flashHead}>
        <span className={s.flashBadge}>{t.badge}</span>
        <Countdown endsAt={flash.endsAt} lang={lang} />
      </p>
      {lowFlash(flash.remaining) ? (
        <p className={s.flashLow}>
          {fmt(t.onlyLeft, { n: localizeDigits(flash.remaining, lang) })}
        </p>
      ) : null}
      {flash.perCustomerLimit ? (
        <p className={s.facts}>
          {fmt(t.limit, { n: localizeDigits(flash.perCustomerLimit, lang) })}
        </p>
      ) : null}
    </div>
  );
}
