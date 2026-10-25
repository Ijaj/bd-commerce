import Link from 'next/link';
import type { ReactNode } from 'react';
import { FlashTag } from '~/features/promotions/FlashTag';
import { dict, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatCompact, formatRating } from '~/lib/format';
import type { ProductCard as ProductCardData } from '~/lib/types';
import { Img } from './Img';
import { Price } from './Price';
import s from './ProductCard.module.css';

const SIZES = '(max-width: 640px) 50vw, (max-width: 1023px) 25vw, 220px';

/**
 * Product card (doc 02, Q12): image, 1-line title, price + struck old price + discount badge,
 * rating, sold count, badges. No add-to-cart. Whole card links to the product page.
 * `heart` is an optional slot (wishlist heart client component), absolutely positioned top-right.
 * `priority` marks above-the-fold images (first row) as eager.
 */
export function ProductCard({
  product: p,
  lang,
  priority = false,
  heart,
  sizes = SIZES,
}: {
  product: ProductCardData;
  lang: Lang;
  priority?: boolean;
  heart?: ReactNode;
  sizes?: string;
}) {
  const d = dict(lang).common;
  const title = pick(lang, p.titleEn, p.titleBn);
  const url = href(lang, `/p/${p.slug}`);
  const b = p.badges;
  const badges = [
    b.isNew && !b.outOfStock ? { cls: s.bNew, label: d.new } : null,
    b.isPreorder ? { cls: s.bPre, label: d.preorder } : null,
    b.isUpcoming ? { cls: s.bUp, label: d.upcoming } : null,
  ].filter((x): x is { cls: string; label: string } => x !== null);

  return (
    <article className={`${s.card} ${b.outOfStock ? s.oos : ''}`}>
      <Link className={s.media} href={url} tabIndex={-1} aria-hidden="true">
        <Img image={p.image} alt="" sizes={sizes} priority={priority} />
        {badges.length > 0 && !b.outOfStock ? (
          <span className={s.badges}>
            {badges.map((x) => (
              <span key={x.label} className={`${s.bdg} ${x.cls}`}>
                {x.label}
              </span>
            ))}
          </span>
        ) : null}
        {b.outOfStock ? (
          <span className={s.oosLabel}>
            <span>{d.outOfStock}</span>
          </span>
        ) : null}
      </Link>
      {heart ? <div className={s.heart}>{heart}</div> : null}
      <div className={s.body}>
        <Link className={s.title} href={url} title={title}>
          {title}
        </Link>
        {b.outOfStock ? <span className="sr-only">{d.outOfStock}</span> : null}
        <Price
          lang={lang}
          priceP={p.priceP}
          compareAtP={p.compareAtP}
          discountPct={p.discountPct}
        />
        {p.flashEndsAt ? <FlashTag endsAt={p.flashEndsAt} lang={lang} /> : null}
        {!b.isUpcoming && (p.ratingCount > 0 || p.soldCount > 0) ? (
          <div className={s.meta}>
            {p.ratingCount > 0 ? (
              <span className={s.rate}>
                <span className={s.star} aria-hidden="true">
                  ★
                </span>{' '}
                {formatRating(p.ratingAvg, lang)}
              </span>
            ) : null}
            {p.ratingCount > 0 && p.soldCount > 0 ? <span aria-hidden="true">·</span> : null}
            {p.soldCount > 0 ? (
              <span>
                {formatCompact(p.soldCount, lang)} {d.sold}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
