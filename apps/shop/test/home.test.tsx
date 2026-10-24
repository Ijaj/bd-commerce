import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Carousel } from '~/features/home/Carousel';
import { CategoryMenu } from '~/features/home/CategoryMenu';
import { FeedMore } from '~/features/home/FeedMore';
import { chunk, parseRecent, readableOn, rowKind, slideLink } from '~/features/home/logic';
import { SpecialRow } from '~/features/home/SpecialRow';
import type { HomeSlide } from '~/features/home/types';
import { dict } from '~/i18n';
import type { CategoryNode, ImageSet, ProductCard } from '~/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const img = (w = 1200, h = 400): ImageSet => ({
  alt: null,
  width: w,
  height: h,
  url320: 'a.webp',
  url640: 'b.webp',
  url1200: 'c.webp',
});
const slide = (n: number, linkUrl: string | null = null): HomeSlide => ({
  id: `s${n}`,
  title: `Slide title ${n}`,
  linkUrl,
  desktop: img(),
  mobile: n === 1 ? img(800, 500) : null,
});
const labels = {
  region: 'Promotions',
  prev: 'Prev',
  next: 'Next',
  pause: 'Pause',
  play: 'Play',
  goTo: 'Go to {n}',
  slideOf: 'Slide {n} of {m}',
};
const product = (n: number): ProductCard => ({
  id: `p${n}`,
  slug: `p-${n}`,
  titleEn: `Product ${n}`,
  titleBn: null,
  image: null,
  priceP: 10000,
  compareAtP: null,
  discountPct: null,
  ratingAvg: 0,
  ratingCount: 0,
  soldCount: 0,
  badges: { isNew: false, isPreorder: false, isUpcoming: false, outOfStock: false },
});

describe('home logic', () => {
  it('chunks, rotates row kinds, parses recent ids', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect([0, 1, 2, 3].map(rowKind)).toEqual(['flash', 'recent', 'event', 'flash']);
    expect(parseRecent('["a","b"]')).toEqual(['a', 'b']);
    expect(parseRecent('[{"id":"a"},{"x":1}]')).toEqual(['a']);
    expect(parseRecent('nope')).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
  });
  it('picks readable chip text and prefixes internal slide links', () => {
    expect(readableOn('#ffffff')).toBe('#1e1b3a');
    expect(readableOn('#1e1b3a')).toBe('#fff');
    expect(slideLink('bn', '/c/shoes')).toEqual({ href: '/bn/c/shoes', external: false });
    expect(slideLink('en', 'https://x.test')).toEqual({ href: 'https://x.test', external: true });
    expect(slideLink('en', null)).toBeNull();
  });
});

describe('Carousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  });
  afterEach(() => vi.useRealTimers());

  it('first image eager, the rest lazy; only the current slide is reachable', () => {
    const { container } = render(
      <Carousel slides={[slide(1, '/c/a'), slide(2), slide(3)]} lang="en" labels={labels} />,
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs[0]?.getAttribute('loading')).toBe('eager');
    expect(imgs[1]?.getAttribute('loading')).toBe('lazy');
    expect(container.querySelector('source')?.getAttribute('media')).toBe('(max-width: 640px)');
    expect(container.querySelectorAll('[inert]')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Slide title 1' })).toHaveAttribute('href', '/c/a');
  });

  it('auto-rotates, pauses on hover and via the pause button, and navigates with dots', () => {
    render(<Carousel slides={[slide(1), slide(2), slide(3)]} lang="en" labels={labels} />);
    const dot = (i: number) => screen.getByRole('button', { name: `Go to ${i}` });
    expect(dot(1)).toHaveAttribute('aria-current', 'true');
    act(() => void vi.advanceTimersByTime(5100));
    expect(dot(2)).toHaveAttribute('aria-current', 'true');

    const region = screen.getByRole('region', { name: 'Promotions' });
    fireEvent.mouseEnter(region);
    act(() => void vi.advanceTimersByTime(20000));
    expect(dot(2)).toHaveAttribute('aria-current', 'true');
    fireEvent.mouseLeave(region);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => void vi.advanceTimersByTime(20000));
    expect(dot(2)).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    fireEvent.click(dot(1));
    expect(dot(1)).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(dot(3)).toHaveAttribute('aria-current', 'true');
  });

  it('swipes on touch', () => {
    render(<Carousel slides={[slide(1), slide(2)]} lang="en" labels={labels} />);
    const region = screen.getByRole('region', { name: 'Promotions' });
    fireEvent.touchStart(region, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getByRole('button', { name: 'Go to 2' })).toHaveAttribute('aria-current', 'true');
  });

  it('starts paused for reduced motion and has no controls for a single slide', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const { unmount } = render(
      <Carousel slides={[slide(1), slide(2)]} lang="en" labels={labels} />,
    );
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    unmount();
    render(<Carousel slides={[slide(1)]} lang="en" labels={labels} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('CategoryMenu', () => {
  const node = (id: string, level: number, children: CategoryNode[] = []): CategoryNode => ({
    id,
    slug: id,
    nameEn: `N-${id}`,
    nameBn: null,
    level,
    chipColor: null,
    image: null,
    icon: null,
    children,
  });
  it('renders four levels with language-aware links', () => {
    const tree = [node('a', 1, [node('b', 2, [node('c', 3, [node('d', 4)])])])];
    render(<CategoryMenu tree={tree} lang="bn" />);
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(screen.getAllByRole('link', { name: `N-${id}` })[0]).toHaveAttribute(
        'href',
        `/bn/c/${id}`,
      );
    }
  });
});

describe('FeedMore', () => {
  const feedLabels = {
    loadMore: 'Load more',
    loading: 'Loading',
    showing: 'Showing {n} products',
    error: 'Oops',
    recent: 'Recent',
  };
  const base = {
    seed: 7,
    every: 2,
    lang: 'en' as const,
    labels: feedLabels,
    firstSlot: 0,
    shown: 0,
  };
  beforeEach(() => {
    // no IntersectionObserver in jsdom: the button is the manual fallback
    vi.stubGlobal('IntersectionObserver', undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the next page with the same seed, drops duplicates, hides the button at the end', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [product(1), product(2), product(3)], nextCursor: null }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<FeedMore {...base} cursor="c1" carry={[product(1)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('seed=7');
    expect(url).toContain('cursor=c1');
    expect(screen.getByText('Showing 3 products')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows an error and keeps the button on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<FeedMore {...base} cursor="c1" carry={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Oops');
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled();
  });
});

describe('SpecialRow', () => {
  it('recent row shows stored products; flash and event render nothing', async () => {
    localStorage.setItem('bdc_recent', JSON.stringify(['p1', 'p2']));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [product(1), product(2)] }),
    );
    const { container, rerender } = render(
      <SpecialRow kind="flash" lang="en" recentTitle="Recent" />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<SpecialRow kind="event" lang="en" recentTitle="Recent" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SpecialRow kind="recent" lang="en" recentTitle={dict('en').home.recent} />);
    expect(await screen.findByRole('heading', { name: 'Recently viewed' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    localStorage.clear();
    vi.unstubAllGlobals();
  });
});
