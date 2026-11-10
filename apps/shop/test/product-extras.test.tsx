import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ product: vi.fn(), similar: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('~/features/browse/api', () => ({
  fetchProduct: mocks.product,
  fetchSimilar: mocks.similar,
}));
vi.mock('~/features/browse/ProductView', () => ({
  ProductView: ({ header }: { header: React.ReactNode }) => <div>{header}</div>,
}));
vi.mock('~/features/browse/ProductRow', () => ({ ProductRow: () => null }));
vi.mock('~/features/browse/RecentlyViewed', () => ({ RecentlyViewed: () => null }));
vi.mock('~/features/promotions/CouponsSection', () => ({ CouponsSection: () => null }));

import ProductPage from '~/app/[lang]/p/[slug]/page';
import { ShareRow } from '~/features/browse/ShareRow';
import { browseBn } from '~/features/browse/strings.bn';
import { browseEn } from '~/features/browse/strings.en';

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'tee',
  titleEn: 'Tee',
  titleBn: 'টি',
  shortDescriptionEn: null,
  shortDescriptionBn: null,
  descriptionHtmlEn: null,
  descriptionHtmlBn: null,
  youtubeUrl: null,
  brand: null,
  breadcrumb: [],
  images: [],
  options: [],
  variants: [],
  specs: [],
  badges: { isNew: false, isPreorder: false, isUpcoming: false, outOfStock: false },
  isPreorder: false,
  preorderExpectedDate: null,
  isUpcoming: false,
  ratingAvg: 0,
  ratingCount: 0,
  soldCount: 0,
  tags: [],
  warrantyEn: null,
  warrantyBn: null,
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  seoTitle: null,
  seoDescription: null,
  updatedAt: '2026-11-10T00:00:00.000Z',
  ...over,
});
const params = (lang: string) => ({ params: Promise.resolve({ lang, slug: 'tee' }) });

beforeEach(() => {
  mocks.product.mockReset();
  mocks.similar.mockResolvedValue([]);
});

describe('product page extras (C7)', () => {
  it('shows warranty, dimensions and tag chips that link to search', async () => {
    mocks.product.mockResolvedValue(
      product({
        tags: ['cotton', 'gift set'],
        warrantyEn: '1 year',
        lengthMm: 300,
        widthMm: 200,
        heightMm: 100,
      }),
    );
    render(await ProductPage(params('en')));
    expect(screen.getByText(browseEn.warranty)).toBeInTheDocument();
    expect(screen.getByText('1 year')).toBeInTheDocument();
    expect(screen.getByText('300 × 200 × 100 mm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cotton' })).toHaveAttribute(
      'href',
      '/search?q=cotton',
    );
    expect(screen.getByRole('link', { name: 'gift set' })).toHaveAttribute(
      'href',
      '/search?q=gift%20set',
    );
  });

  it('uses Bangla labels, digits and the English warranty fallback on /bn', async () => {
    mocks.product.mockResolvedValue(
      product({ warrantyEn: '1 year', lengthMm: 30, widthMm: 20, heightMm: 10 }),
    );
    render(await ProductPage(params('bn')));
    expect(screen.getByText(browseBn.warranty)).toBeInTheDocument();
    expect(screen.getByText('1 year')).toBeInTheDocument();
    expect(screen.getByText(`৩০ × ২০ × ১০ ${browseBn.mm}`)).toBeInTheDocument();
  });

  it('hides the sections when the product has none of them', async () => {
    mocks.product.mockResolvedValue(product());
    render(await ProductPage(params('en')));
    expect(screen.queryByText(browseEn.warranty)).toBeNull();
    expect(screen.queryByText(browseEn.tags)).toBeNull();
  });
});

describe('ShareRow (C1)', () => {
  const labels = {
    heading: 'Share',
    native: 'Share via',
    copy: 'Copy link',
    copied: 'Link copied',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
  };
  const url = 'https://shop.test/p/tee';

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).share;
    vi.restoreAllMocks();
  });

  it('offers copy-link plus WhatsApp and Facebook without native share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareRow url={url} title="Tee" labels={labels} />);
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`Tee ${url}`)}`,
    );
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument(),
    );
  });

  it('uses navigator.share when the browser has it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<ShareRow url={url} title="Tee" labels={labels} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Share via' }));
    expect(share).toHaveBeenCalledWith({ title: 'Tee', url });
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
  });
});
