'use client';
import { usePathname } from 'next/navigation';
import { dict, type Lang } from '~/i18n';
import { switchLangPath } from '~/i18n/routing';
import s from './Toggles.module.css';

/** EN | বাং switch. Same page in the other language; keeps ?query and #hash on click. */
export function LangToggle({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const go = (to: Lang) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.assign(
      switchLangPath(window.location.pathname, to) + window.location.search + window.location.hash,
    );
  };
  return (
    <div className={s.seg} role="group" aria-label={dict(lang).shell.language}>
      <a
        href={switchLangPath(pathname, 'en')}
        hrefLang="en"
        lang="en"
        aria-current={lang === 'en' ? 'true' : undefined}
        onClick={go('en')}
      >
        EN
      </a>
      <a
        href={switchLangPath(pathname, 'bn')}
        hrefLang="bn"
        lang="bn"
        aria-current={lang === 'bn' ? 'true' : undefined}
        onClick={go('bn')}
      >
        বাং
      </a>
    </div>
  );
}
