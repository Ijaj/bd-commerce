'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '~/components/Icon';
import { ProductGrid } from '~/components/ProductGrid';
import { EmptyState } from '~/components/States';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import type { ProductCard } from '~/lib/types';
import s from './account.module.css';
import { seedWishlist, setWishlisted } from './wishlist-store';

/** The saved products with a remove button per card; removing updates the list at once. */
export function WishlistGrid({ lang, items }: { lang: Lang; items: ProductCard[] }) {
  const d = dict(lang).account;
  const [list, setList] = useState(items);

  useEffect(() => {
    seedWishlist(items.map((p) => p.id));
  }, [items]);

  async function remove(id: string) {
    const prev = list;
    setList((l) => l.filter((p) => p.id !== id));
    const ok = await setWishlisted(id, false);
    if (!ok) setList(prev);
  }

  if (list.length === 0) {
    return (
      <EmptyState
        lang={lang}
        title={d.wishlistEmpty}
        body={d.wishlistEmptyBody}
        action={
          <Link className="btn btn-primary" href={href(lang, '/')}>
            {d.keepShopping}
          </Link>
        }
      />
    );
  }
  return (
    <ProductGrid
      products={list}
      lang={lang}
      priorityCount={6}
      renderHeart={(p) => (
        <button
          type="button"
          className={s.remove}
          aria-label={`${d.removeFromWishlist}: ${lang === 'bn' && p.titleBn ? p.titleBn : p.titleEn}`}
          title={d.removeFromWishlist}
          onClick={() => remove(p.id)}
        >
          <Icon name="close" size={18} />
        </button>
      )}
    />
  );
}
