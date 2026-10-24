'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '~/features/account/session';
import { dict, type Lang } from '~/i18n';
import { href, stripLang } from '~/i18n/routing';
import { Icon, type IconName } from '../Icon';
import s from './BottomNav.module.css';

const ITEMS: {
  key: 'home' | 'categories' | 'offers' | 'cart' | 'account';
  path: string;
  icon: IconName;
  match: RegExp;
}[] = [
  { key: 'home', path: '/', icon: 'home', match: /^\/$/ },
  { key: 'categories', path: '/categories', icon: 'grid', match: /^\/(categories|c)(\/|$)/ },
  { key: 'offers', path: '/offers', icon: 'tag', match: /^\/offers(\/|$)/ },
  { key: 'cart', path: '/cart', icon: 'cart', match: /^\/cart(\/|$)/ },
  {
    key: 'account',
    path: '/account',
    icon: 'user',
    match: /^\/(account|login|signup|reset|wishlist)(\/|$)/,
  },
];

/** Mobile bottom nav (Q11). Hidden above 640px. */
export function BottomNav({ lang }: { lang: Lang }) {
  const path = stripLang(usePathname());
  const d = dict(lang);
  const { me } = useSession();
  return (
    <nav className={s.bnav} aria-label={d.shell.mainNav}>
      {ITEMS.map((it) => (
        <Link
          key={it.key}
          href={href(lang, it.path)}
          aria-current={it.match.test(path) ? 'page' : undefined}
        >
          <Icon name={it.icon} size={22} />
          <span>{it.key === 'account' && !me ? d.shell.login : d.nav[it.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
