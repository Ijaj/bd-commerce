'use client';
import { dict, type Lang } from '~/i18n';
import { Icon } from '../Icon';
import s from './Toggles.module.css';

/** Light/dark toggle. Choice persists in the bdc_theme cookie; the inline script in the layout applies it pre-paint. */
export function ThemeToggle({ lang }: { lang: Lang }) {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available on older Android browsers
    document.cookie = `bdc_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button
      className={s.iconBtn}
      type="button"
      onClick={toggle}
      aria-label={dict(lang).shell.toggleTheme}
    >
      <span className={s.sun}>
        <Icon name="sun" size={18} />
      </span>
      <span className={s.moon}>
        <Icon name="moon" size={18} />
      </span>
    </button>
  );
}
