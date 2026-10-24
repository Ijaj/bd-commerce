import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumb } from '~/components/Breadcrumb';
import { Img } from '~/components/Img';
import { Price } from '~/components/Price';
import { ProductCard } from '~/components/ProductCard';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';
import { formatCompact, formatRating } from '~/lib/format';
import type { ProductCard as Card } from '~/lib/types';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const img = {
  alt: 'Panjabi',
  width: 800,
  height: 800,
  url320: '/a-320',
  url640: '/a-640',
  url1200: '/a-1200',
};
const card: Card = {
  id: '1',
  slug: 'blue-panjabi',
  titleEn: 'Blue Panjabi',
  titleBn: 'নীল পাঞ্জাবি',
  image: img,
  priceP: 125000,
  compareAtP: 150000,
  discountPct: 17,
  ratingAvg: 4.5,
  ratingCount: 12,
  soldCount: 1200,
  badges: { isNew: true, isPreorder: false, isUpcoming: false, outOfStock: false },
};

describe('ProductCard', () => {
  it('renders EN with price, old price, discount, rating and sold', () => {
    render(<ProductCard product={card} lang="en" />);
    expect(screen.getByRole('link', { name: 'Blue Panjabi' })).toHaveAttribute(
      'href',
      '/p/blue-panjabi',
    );
    expect(screen.getByText('৳1,250')).toBeInTheDocument();
    expect(screen.getByText('৳1,500')).toBeInTheDocument();
    expect(screen.getByText('-17%')).toBeInTheDocument();
    expect(screen.getByText('4.5', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1.2k sold')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });
  it('renders BN title, digits and /bn link', () => {
    render(<ProductCard product={card} lang="bn" />);
    expect(screen.getByRole('link', { name: 'নীল পাঞ্জাবি' })).toHaveAttribute(
      'href',
      '/bn/p/blue-panjabi',
    );
    expect(screen.getByText('৳১,২৫০')).toBeInTheDocument();
    expect(screen.getByText('-১৭%')).toBeInTheDocument();
  });
  it('labels out-of-stock and hides the New badge', () => {
    render(
      <ProductCard product={{ ...card, badges: { ...card.badges, outOfStock: true } }} lang="en" />,
    );
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });
});

describe('Img', () => {
  it('builds srcset, lazy by default, eager with priority', () => {
    const { rerender } = render(<Img image={img} sizes="100vw" />);
    const el = screen.getByRole('img');
    expect(el).toHaveAttribute('srcset', '/a-320 320w, /a-640 640w, /a-1200 1200w');
    expect(el).toHaveAttribute('loading', 'lazy');
    rerender(<Img image={img} sizes="100vw" priority />);
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'eager');
  });
  it('renders a placeholder without an image', () => {
    const { container } = render(<Img image={null} sizes="100vw" />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Price', () => {
  it('shows no old price when not on sale', () => {
    render(<Price lang="en" priceP={50000} compareAtP={50000} discountPct={null} />);
    expect(screen.queryByText('Was', { exact: false })).not.toBeInTheDocument();
  });
});

describe('Breadcrumb', () => {
  it('marks the last item as current page', () => {
    render(<Breadcrumb lang="en" items={[{ label: 'Home', href: '/' }, { label: 'Shoes' }]} />);
    expect(screen.getByText('Shoes')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
  });
});

describe('format + dictionaries', () => {
  it('formats compact counts and ratings by language', () => {
    expect(formatCompact(950, 'en')).toBe('950');
    expect(formatCompact(25000, 'en')).toBe('25k');
    expect(formatCompact(1200, 'bn')).toBe('১.২ হাজার');
    expect(formatRating(4, 'bn')).toBe('৪.০');
  });
  it('keeps en and bn dictionaries in the same shape', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(bn)).toEqual(keys(en));
  });
});
