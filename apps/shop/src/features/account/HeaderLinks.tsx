'use client';
import { localizeDigits } from '@bdc/i18n';
import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '~/components/Icon';
import s from '~/components/shell/Header.module.css';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { useSession } from './session';
import { ensureWishlistIds, useWishlistIds } from './wishlist-store';

/** Header "Login" link that becomes the customer's first name once the session is known. */
export function HeaderAccount({ lang }: { lang: Lang }) {
  const d = dict(lang).shell;
  const { me } = useSession();
  const first = me?.name.trim().split(/\s+/)[0];
  return (
    <Link
      href={href(lang, me ? '/account' : '/login')}
      aria-label={me ? `${d.account}: ${me.name}` : d.login}
    >
      <Icon name="user" size={24} />
      <span className={s.lbl}>{first || d.login}</span>
    </Link>
  );
}

/** Header wishlist link with a count badge (logged-in customers only). */
export function HeaderWishlist({ lang }: { lang: Lang }) {
  const d = dict(lang).shell;
  const { me } = useSession();
  const ids = useWishlistIds();
  const userId = me?.id;
  useEffect(() => {
    if (userId) void ensureWishlistIds();
  }, [userId]);
  return (
    <Link href={href(lang, '/wishlist')} aria-label={d.wishlist}>
      <Icon name="heart" size={24} />
      <span className={s.lbl}>{d.wishlist}</span>
      {ids.size > 0 ? (
        <span className={s.cnt}>
          <span className="sr-only">{d.wishlist}: </span>
          {localizeDigits(ids.size, lang)}
        </span>
      ) : null}
    </Link>
  );
}
