import { dict, type Lang } from '~/i18n';
import { formatDateTime } from './format';
import s from './orders.module.css';
import type { OrdersDict } from './strings.en';

type Step = { status: keyof OrdersDict['status']; at: string };

/** Status history, oldest first; the last entry is the current status. */
export function Timeline({ lang, steps }: { lang: Lang; steps: Step[] }) {
  const d = dict(lang).orders;
  return (
    <ol className={s.timeline} aria-label={d.timeline}>
      {steps.map((st, i) => {
        const current = i === steps.length - 1;
        return (
          <li key={`${st.status}-${st.at}`} className={current ? s.current : undefined}>
            <span className={s.dot} aria-hidden="true" />
            <span className={s.stepText}>
              <span>{d.status[st.status]}</span>
              <time className={s.muted} dateTime={st.at}>
                {formatDateTime(st.at, lang)}
              </time>
            </span>
            {current ? <span className="sr-only"> ({d.status[st.status]})</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
