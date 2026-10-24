import Link from 'next/link';
import { HeaderAccount, HeaderWishlist } from '~/features/account/HeaderLinks';
import { SearchBox } from '~/features/browse/SearchBox';
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
  const b = dict(lang).browse;
  const searchLabels = {
    placeholder: d.searchPlaceholder,
    search: d.search,
    suggestions: b.suggestions,
    products: b.sugProducts,
    categories: b.sugCategories,
    brands: b.sugBrands,
    none: b.sugNone,
    all: b.searchAll,
  };
  return (
    <header className={`${s.hdr} on-dark`}>
      <div className={`wrap ${s.desktop}`}>
        <Logo lang={lang} />
        <SearchBox lang={lang} labels={searchLabels} className={s.search}>
          <button type="submit">
            <Icon name="search" size={18} />
            <span>{d.search}</span>
          </button>
        </SearchBox>
        <div className={s.act}>
          <HeaderWishlist lang={lang} />
          <Link href={href(lang, '/cart')} aria-label={d.cart}>
            <Icon name="cart" size={24} />
            <span className={s.lbl}>{d.cart}</span>
            <span className={s.cnt} id="cart-count" hidden>
              0
            </span>
          </Link>
          <HeaderAccount lang={lang} />
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
          <SearchBox
            lang={lang}
            labels={{ ...searchLabels, placeholder: d.searchPlaceholderShort }}
            className={`${s.search} ${s.searchM}`}
            before={<Icon name="search" size={18} className={s.si} />}
          />
        </div>
      </div>
    </header>
  );
}
