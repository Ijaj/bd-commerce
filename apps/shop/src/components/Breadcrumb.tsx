import Link from 'next/link';
import { dict, type Lang } from '~/i18n';
import s from './Breadcrumb.module.css';
import { Icon } from './Icon';

export type Crumb = { label: string; href?: string };

/** Breadcrumb trail. The last item is the current page (bold, Q113) and is not a link. Pass full hrefs (use `href(lang, ...)`). */
export function Breadcrumb({ items, lang }: { items: Crumb[]; lang: Lang }) {
  return (
    <nav className={s.bc} aria-label={dict(lang).shell.breadcrumb}>
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href ?? c.label}>
              {last || !c.href ? (
                <span
                  className={last ? s.current : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {c.label}
                </span>
              ) : (
                <Link href={c.href}>{c.label}</Link>
              )}
              {last ? null : <Icon name="chevR" size={12} className={s.sep} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
