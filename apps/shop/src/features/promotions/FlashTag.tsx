import { dict, type Lang } from '~/i18n';
import { Countdown } from './Countdown';
import s from './promotions.module.css';

/** Card line under the price while a flash price is live. */
export function FlashTag({ endsAt, lang }: { endsAt: string; lang: Lang }) {
  return (
    <span className={s.flashTag}>
      <span className={s.flashBadge}>{dict(lang).promos.flash.short}</span>
      <Countdown endsAt={endsAt} lang={lang} />
    </span>
  );
}
