'use client';
import { localizeDigits } from '@bdc/i18n';
import { useEffect } from 'react';
import s from '~/components/shell/Header.module.css';
import { useSession } from '~/features/account/session';
import { dict, type Lang } from '~/i18n';
import { mayHaveCart, refreshCart, useCart } from './store';

/**
 * Header cart badge. Loads the count once per page load when this browser may have a cart,
 * and again when the visitor logs in or out (the guest cart is merged into the account cart).
 */
export function CartCount({ lang, className }: { lang: Lang; className?: string }) {
  const cart = useCart();
  const { ready, me } = useSession();
  const userId = me?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId is the trigger, not a value read inside
  useEffect(() => {
    if (ready && mayHaveCart()) void refreshCart();
  }, [ready, userId]);
  const n = cart?.count ?? 0;
  if (n <= 0) return null;
  return (
    <span className={className ?? s.cnt}>
      <span className="sr-only">{dict(lang).shell.cart}: </span>
      {localizeDigits(n, lang)}
    </span>
  );
}
