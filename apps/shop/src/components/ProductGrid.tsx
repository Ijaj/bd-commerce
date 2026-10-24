import type { ReactNode } from 'react';
import type { Lang } from '~/i18n';
import type { ProductCard as ProductCardData } from '~/lib/types';
import { ProductCard } from './ProductCard';
import s from './ProductGrid.module.css';

/**
 * Responsive grid of ProductCard: 2 cols on phones, 4 on tablets, 6 on desktop
 * (`compact`: max 4, for pages with a filter sidebar). The first `priorityCount` images load eagerly.
 * `renderHeart` lets a page add the wishlist heart per card.
 */
export function ProductGrid({
  products,
  lang,
  compact = false,
  priorityCount = 0,
  renderHeart,
}: {
  products: ProductCardData[];
  lang: Lang;
  compact?: boolean;
  priorityCount?: number;
  renderHeart?: (p: ProductCardData) => ReactNode;
}) {
  return (
    <ul className={`${s.grid} ${compact ? s.compact : ''}`}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard
            product={p}
            lang={lang}
            priority={i < priorityCount}
            heart={renderHeart?.(p)}
          />
        </li>
      ))}
    </ul>
  );
}
