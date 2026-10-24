import { ProductCard } from '~/components/ProductCard';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import type { Lang } from '~/i18n';
import type { ProductCard as Card } from '~/lib/types';
import s from './Product.module.css';

/** Horizontal scroll-snap row of product cards (similar products). */
export function ProductRow({
  title,
  products,
  lang,
}: {
  title: string;
  products: Card[];
  lang: Lang;
}) {
  if (products.length === 0) return null;
  return (
    <section className={s.rowSec} aria-labelledby="similar-h">
      <div className="sec-head">
        <h2 id="similar-h">{title}</h2>
      </div>
      <ul className={s.row}>
        {products.map((c) => (
          <li key={c.id}>
            <ProductCard
              product={c}
              lang={lang}
              heart={<WishlistHeart productId={c.id} lang={lang} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
