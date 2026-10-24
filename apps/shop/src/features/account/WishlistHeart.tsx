'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '~/components/Icon';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { ensureSession, useSession } from './session';
import s from './WishlistHeart.module.css';
import { ensureWishlistIds, isWishlisted, setWishlisted, useWishlistIds } from './wishlist-store';

/**
 * Heart toggle for product cards and the product page (C29: needs a login).
 * Logged out: goes to /login?next=<this page>. Logged in: optimistic add/remove; the shared id set
 * is fetched once per page load. Renders unpressed until the session is known (static pages).
 */
export function WishlistHeart({
  productId,
  lang,
  className,
}: {
  productId: string;
  lang: Lang;
  className?: string;
}) {
  const router = useRouter();
  const { me } = useSession();
  const ids = useWishlistIds();
  const [busy, setBusy] = useState(false);
  const label = dict(lang).shell.wishlist;
  const on = ids.has(productId);

  const userId = me?.id;
  useEffect(() => {
    if (userId) void ensureWishlistIds();
  }, [userId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const user = await ensureSession();
      if (!user) {
        const here = `${window.location.pathname}${window.location.search}`;
        router.push(`${href(lang, '/login')}?next=${encodeURIComponent(here)}`);
        return;
      }
      await ensureWishlistIds();
      await setWishlisted(productId, !isWishlisted(productId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`${s.heart} ${on ? s.on : ''} ${className ?? ''}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      <Icon name="heart" size={20} />
    </button>
  );
}
