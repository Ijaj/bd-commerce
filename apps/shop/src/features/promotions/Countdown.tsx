'use client';
import { useEffect, useState } from 'react';
import { dict, fmt, type Lang } from '~/i18n';
import { formatRemaining } from './logic';
import s from './promotions.module.css';

// One interval for every countdown on the page (a product grid can hold dozens).
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  subscribers.add(cb);
  timer ??= setInterval(() => {
    for (const f of subscribers) f();
  }, 1000);
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * Ticking "Ends in 02:03:04". Server HTML is built from a cached page, so the first client render
 * differs by design (suppressHydrationWarning). Digits are tabular and the label is a single
 * inline-block of fixed `ch` width, so ticking does not shift the layout. Renders nothing at zero.
 * `mode="starts"` flips the wording for upcoming sales.
 */
export function Countdown({
  endsAt,
  lang,
  mode = 'ends',
  onEnd,
  className,
}: {
  endsAt: string;
  lang: Lang;
  mode?: 'ends' | 'starts';
  onEnd?: () => void;
  className?: string;
}) {
  const t = dict(lang).promos.countdown;
  const target = Date.parse(endsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    return subscribe(() => setNow(Date.now()));
  }, []);

  const left = target - now;
  const ended = left <= 0;
  useEffect(() => {
    if (ended) onEnd?.();
  }, [ended, onEnd]);

  const clock = formatRemaining(left, lang, t.day);
  if (!clock) return null;
  return (
    <time
      dateTime={endsAt}
      className={`${s.countdown} ${className ?? ''}`}
      suppressHydrationWarning
    >
      {fmt(mode === 'starts' ? t.startsIn : t.endsIn, { t: clock })}
    </time>
  );
}
