'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { customerApi } from './api';
import { setSessionMe } from './session';
import { clearWishlist } from './wishlist-store';

export function LogoutButton({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await customerApi.logout();
    // Clear client state even if the request failed: the cookie is httpOnly and expires on its own.
    setSessionMe(null);
    clearWishlist();
    router.replace(href(lang, '/'));
    router.refresh();
  }
  return (
    <button type="button" className="btn btn-ghost" disabled={busy} onClick={logout}>
      {dict(lang).account.logout}
    </button>
  );
}
