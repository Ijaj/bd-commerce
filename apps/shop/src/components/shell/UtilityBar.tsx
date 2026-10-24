import Link from 'next/link';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { Icon } from '../Icon';
import { LangToggle } from './LangToggle';
import { ThemeToggle } from './ThemeToggle';
import s from './UtilityBar.module.css';

/** Desktop-only strip above the header: hotline left; track order, language and theme right. */
export function UtilityBar({ lang, hotline }: { lang: Lang; hotline?: string }) {
  const d = dict(lang).shell;
  return (
    <div className={`${s.bar} on-dark`}>
      <div className={`wrap ${s.row}`}>
        <div className={s.left}>
          {hotline ? (
            <>
              <Icon name="phone" size={14} /> <span>{d.hotline}</span>:{' '}
              <a href={`tel:${hotline.replace(/[^+\d]/g, '')}`}>{hotline}</a>
            </>
          ) : null}
        </div>
        <nav className={s.right} aria-label={d.utility}>
          <Link href={href(lang, '/track')}>{d.trackOrder}</Link>
          <LangToggle lang={lang} />
          <ThemeToggle lang={lang} />
        </nav>
      </div>
    </div>
  );
}
