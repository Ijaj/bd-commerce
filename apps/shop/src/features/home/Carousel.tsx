'use client';
import Link from 'next/link';
import { type ReactNode, type TouchEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '~/components/Icon';
import { fmt, type Lang } from '~/i18n';
import type { ImageSet } from '~/lib/types';
import s from './Carousel.module.css';
import { slideLink } from './logic';
import type { HomeSlide } from './types';

export type CarouselLabels = {
  region: string;
  prev: string;
  next: string;
  pause: string;
  play: string;
  /** "Go to slide {n}" */
  goTo: string;
  /** "Slide {n} of {m}" */
  slideOf: string;
};

const INTERVAL_MS = 5000;
const SWIPE_PX = 40;

const set = (i: ImageSet) => `${i.url320} 320w, ${i.url640} 640w, ${i.url1200} 1200w`;

function Slide({ slide, first }: { slide: HomeSlide; first: boolean }) {
  const { desktop: d, mobile: m } = slide;
  return (
    <picture>
      {m ? <source media="(max-width: 640px)" srcSet={set(m)} sizes="100vw" /> : null}
      <img
        className={s.img}
        src={d.url1200}
        srcSet={set(d)}
        sizes="(min-width: 1360px) 1050px, (min-width: 1024px) calc(100vw - 310px), 100vw"
        width={d.width}
        height={d.height}
        alt={slide.title}
        loading={first ? 'eager' : 'lazy'}
        fetchPriority={first ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  );
}

/**
 * Home carousel (doc 02 "Carousel"): auto-rotates, pauses on hover, focus and touch, swipe on touch,
 * arrows + dots + a pause button (WCAG 2.2.2). Starts paused when the visitor prefers reduced motion.
 * Slides come from the API already time-window filtered. First slide is the LCP image.
 */
export function Carousel({
  slides,
  lang,
  labels,
}: {
  slides: HomeSlide[];
  lang: Lang;
  labels: CarouselLabels;
}) {
  const n = slides.length;
  const [idx, setIdx] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touch, setTouch] = useState(false);
  const [hidden, setHidden] = useState(false);
  const x0 = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setUserPaused(true);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const running = n > 1 && !userPaused && !hover && !focus && !touch && !hidden;
  // idx is a dependency on purpose: any slide change (auto or manual) restarts the 5 s wait.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [running, idx, n]);

  const go = (i: number) => setIdx(((i % n) + n) % n);

  const onTouchEnd = (e: TouchEvent) => {
    if (x0.current !== null) {
      const dx = (e.changedTouches[0]?.clientX ?? x0.current) - x0.current;
      if (Math.abs(dx) > SWIPE_PX) go(idx + (dx < 0 ? 1 : -1));
    }
    x0.current = null;
    setTouch(false);
  };

  const first = slides[0] as HomeSlide;
  const frame = {
    '--ar-d': `${first.desktop.width} / ${first.desktop.height}`,
    '--ar-m': `${(first.mobile ?? first.desktop).width} / ${(first.mobile ?? first.desktop).height}`,
  } as React.CSSProperties;

  return (
    <section
      className={`${s.car} on-dark`}
      style={frame}
      aria-roledescription="carousel"
      aria-label={labels.region}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
      }}
      onTouchStart={(e) => {
        x0.current = e.touches[0]?.clientX ?? null;
        setTouch(true);
      }}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        x0.current = null;
        setTouch(false);
      }}
    >
      <div
        className={s.track}
        style={{ transform: `translateX(-${idx * 100}%)` }}
        aria-live={running ? 'off' : 'polite'}
      >
        {slides.map((sl, i) => {
          const link = slideLink(lang, sl.linkUrl);
          const body = <Slide slide={sl} first={i === 0} />;
          let inner: ReactNode = body;
          if (link?.external) {
            inner = (
              <a className={s.link} href={link.href} rel="noopener noreferrer">
                {body}
              </a>
            );
          } else if (link) {
            inner = (
              <Link className={s.link} href={link.href}>
                {body}
              </Link>
            );
          }
          return (
            <div
              key={sl.id}
              className={s.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={fmt(labels.slideOf, { n: i + 1, m: n })}
              aria-hidden={i !== idx}
              inert={i !== idx}
            >
              {inner}
            </div>
          );
        })}
      </div>
      {n > 1 ? (
        <>
          <button
            type="button"
            className={`${s.btn} ${s.prev}`}
            aria-label={labels.prev}
            onClick={() => go(idx - 1)}
          >
            <Icon name="chevL" size={20} />
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.next}`}
            aria-label={labels.next}
            onClick={() => go(idx + 1)}
          >
            <Icon name="chevR" size={20} />
          </button>
          <button
            type="button"
            className={s.pp}
            aria-label={userPaused ? labels.play : labels.pause}
            onClick={() => setUserPaused((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {userPaused ? (
                <path d="M7 4.5v15l13-7.5z" />
              ) : (
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              )}
            </svg>
          </button>
          <div className={s.dots}>
            {slides.map((sl, i) => (
              <button
                key={sl.id}
                type="button"
                className={s.dot}
                aria-label={fmt(labels.goTo, { n: i + 1 })}
                aria-current={i === idx}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
