import Link from 'next/link';
import type { Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import s from './Logo.module.css';

/** Wordmark (bold allowed by Q113). The mark is brand B's bolt in the palette-C colours. */
export function Logo({ lang }: { lang: Lang }) {
  return (
    <Link className={s.logo} href={href(lang, '/')} aria-label="ShopName">
      <svg className={s.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect
          className={s.mkBg}
          width="32"
          height="32"
          rx="5"
          transform="skewX(-8) translate(3 0)"
        />
        <path className={s.mkFg} d="M18.5 4 8 18h6.5l-1.5 10L24 13h-6.5z" />
      </svg>
      <span className={s.wm}>
        <b>Shop</b>Name
      </span>
    </Link>
  );
}
