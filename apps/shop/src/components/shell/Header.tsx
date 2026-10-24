import Link from 'next/link';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { Icon } from '../Icon';
import s from './Header.module.css';
import { LangToggle } from './LangToggle';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * Sticky header. Desktop: logo, search, wishlist/cart/account. Mobile: logo + toggles + cart, then search.
 * Counts are placeholders (0, hidden); the cart and wishlist agents replace the `*Count` slots.
 */
export function Header({ lang }: { lang: Lang }) {
  const d = dict(lang).shell;
  return (
    <header className={`${s.hdr} on-dark`}>
      <div className={`wrap ${s.desktop}`}>
        <Logo lang={lang} />
        <form className={s.search} role="search" action={href(lang, '/search')} method="get">
          <input type="search" name="q" placeholder={d.searchPlaceholder} aria-label={d.search} />
          <button type="submit">
            <Icon name="search" size={18} />
            <span>{d.search}</span>
          </button>
        </form>
        <div className={s.act}>
          <Link href={href(lang, '/wishlist')}>
            <Icon name="heart" size={24} />
            <span className={s.lbl}>{d.wishlist}</span>
          </Link>
          <Link href={href(lang, '/cart')}>
            <Icon name="cart" size={24} />
            <span className={s.lbl}>{d.cart}</span>
            <span className={s.cnt} id="cart-count" hidden>
              0
            </span>
          </Link>
          <Link href={href(lang, '/account')}>
            <Icon name="user" size={24} />
            <span className={s.lbl}>{d.login}</span>
          </Link>
        </div>
      </div>

      <div className={s.mobile}>
        <div className={`wrap ${s.r1}`}>
          <Logo lang={lang} />
          <span className={s.grow} />
          <LangToggle lang={lang} />
          <ThemeToggle lang={lang} />
          <Link className={s.cartM} href={href(lang, '/cart')} aria-label={d.cart}>
            <Icon name="cart" size={22} />
          </Link>
        </div>
        <div className={`wrap ${s.r2}`}>
          <form
            className={`${s.search} ${s.searchM}`}
            role="search"
            action={href(lang, '/search')}
            method="get"
          >
            <Icon name="search" size={18} className={s.si} />
            <input
              type="search"
              name="q"
              placeholder={d.searchPlaceholderShort}
              aria-label={d.search}
            />
          </form>
        </div>
      </div>
    </header>
  );
}
