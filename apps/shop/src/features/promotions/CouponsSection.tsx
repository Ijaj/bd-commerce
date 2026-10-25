'use client';
import { useEffect, useState } from 'react';
import { call } from '~/features/account/lib';
import { ensureSession, useSession } from '~/features/account/session';
import type { Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import { CouponCard } from './CouponCard';
import s from './promotions.module.css';
import type { PublicCoupon } from './types';

/**
 * Public coupons for the offers page (`initial` from the cached server render) or one product
 * (`slug`, fetched in the browser: the product page itself stays static). Signed-in customers
 * get a fresh, uncached copy so each card knows whether it is already collected.
 */
export function CouponsSection({
  lang,
  slug,
  initial,
  nextPath,
  heading,
  empty,
}: {
  lang: Lang;
  slug?: string;
  initial?: PublicCoupon[];
  nextPath: string;
  heading: string;
  /** Shown when there is nothing; omit to render nothing at all. */
  empty?: string;
}) {
  const [items, setItems] = useState<PublicCoupon[] | null>(initial ?? null);
  const { me } = useSession();
  const userId = me?.id ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: userId re-runs the fetch after login state is known
  useEffect(() => {
    let live = true;
    void ensureSession().then(async () => {
      // Anonymous offers page already has the server copy.
      if (initial && !userId) return;
      const r = slug
        ? await call(
            browserApi.GET('/v1/public/products/{slug}/coupons', { params: { path: { slug } } }),
          )
        : await call(browserApi.GET('/v1/public/coupons'));
      if (live && r.ok) setItems(r.data.items);
    });
    return () => {
      live = false;
    };
  }, [slug, userId]);

  if (!items) return null;
  if (items.length === 0) {
    return empty ? <p className={s.facts}>{empty}</p> : null;
  }
  return (
    <section className={s.section} aria-label={heading}>
      <h2 className={s.sectionTitle}>{heading}</h2>
      <ul className={s.coupons}>
        {items.map((c) => (
          <CouponCard key={c.id} coupon={c} lang={lang} nextPath={nextPath} />
        ))}
      </ul>
    </section>
  );
}
