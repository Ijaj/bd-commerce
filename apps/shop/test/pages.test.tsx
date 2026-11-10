import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('~/lib/api', () => ({ apiGet: mocks.apiGet }));
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import PageRoute, { generateMetadata } from '~/app/[lang]/pages/[slug]/page';
import { Footer } from '~/components/shell/Footer';
import { fetchFooterPages } from '~/features/pages/data';
import { pageBody, pageTitle } from '~/features/pages/logic';
import { dict } from '~/i18n';

const page = (over: Record<string, unknown> = {}) => ({
  slug: 'about',
  titleEn: 'About us',
  titleBn: 'আমাদের সম্পর্কে',
  bodyHtmlEn: '<p>English body</p>',
  bodyHtmlBn: '<p>বাংলা লেখা</p>',
  seoTitle: null,
  seoDescription: null,
  updatedAt: '2026-11-10T00:00:00.000Z',
  ...over,
});
const params = (lang: string, slug = 'about') => ({ params: Promise.resolve({ lang, slug }) });

beforeEach(() => mocks.apiGet.mockReset());

describe('page language helpers', () => {
  it('uses the shopper language and falls back to the other body', () => {
    const p = page();
    expect(pageTitle('en', p)).toBe('About us');
    expect(pageTitle('bn', p)).toBe('আমাদের সম্পর্কে');
    expect(pageTitle('bn', page({ titleBn: null }))).toBe('About us');
    expect(pageBody('bn', p)).toBe('<p>বাংলা লেখা</p>');
    expect(pageBody('bn', page({ bodyHtmlBn: null }))).toBe('<p>English body</p>');
    expect(pageBody('en', page({ bodyHtmlEn: '  ' }))).toBe('<p>বাংলা লেখা</p>');
    expect(pageBody('en', page({ bodyHtmlEn: null, bodyHtmlBn: null }))).toBe('');
  });
});

describe('/pages/[slug]', () => {
  it('renders the title and body', async () => {
    mocks.apiGet.mockResolvedValue(page());
    render(await PageRoute(params('en')));
    expect(mocks.apiGet.mock.calls[0]?.[0]).toBe('/v1/public/pages/about');
    expect(screen.getByRole('heading', { level: 1, name: 'About us' })).toBeInTheDocument();
    expect(screen.getByText('English body')).toBeInTheDocument();
  });

  it('renders Bangla and falls back to English when the Bangla body is empty', async () => {
    mocks.apiGet.mockResolvedValue(page());
    const { unmount } = render(await PageRoute(params('bn')));
    expect(screen.getByRole('heading', { level: 1, name: 'আমাদের সম্পর্কে' })).toBeInTheDocument();
    expect(screen.getByText('বাংলা লেখা')).toBeInTheDocument();
    unmount();
    mocks.apiGet.mockResolvedValue(page({ bodyHtmlBn: null }));
    render(await PageRoute(params('bn')));
    expect(screen.getByText('English body')).toBeInTheDocument();
  });

  it('404s for an unknown or unpublished page', async () => {
    mocks.apiGet.mockResolvedValue(null);
    await expect(PageRoute(params('en', 'nope'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect((await generateMetadata(params('en', 'nope'))).robots).toEqual({ index: false });
  });

  it('builds metadata from SEO fields, else title and body text', async () => {
    mocks.apiGet.mockResolvedValue(page({ seoTitle: 'SEO', seoDescription: 'Desc' }));
    expect(await generateMetadata(params('en'))).toMatchObject({
      title: 'SEO',
      description: 'Desc',
    });
    mocks.apiGet.mockResolvedValue(page());
    const m = await generateMetadata(params('en'));
    expect(m).toMatchObject({ title: 'About us', description: 'English body' });
    expect(m.alternates?.canonical).toMatch(/\/pages\/about$/);
    expect((await generateMetadata(params('bn'))).alternates?.canonical).toMatch(
      /\/bn\/pages\/about$/,
    );
  });
});

describe('footer pages', () => {
  it('links the published footer pages from the API', async () => {
    mocks.apiGet.mockResolvedValue({
      items: [
        { slug: 'privacy', titleEn: 'Privacy', titleBn: 'গোপনীয়তা' },
        { slug: 'faq', titleEn: 'FAQ', titleBn: null },
      ],
    });
    render(await Footer({ lang: 'bn' }));
    expect(screen.getByRole('link', { name: 'গোপনীয়তা' })).toHaveAttribute(
      'href',
      '/bn/pages/privacy',
    );
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/bn/pages/faq');
    // the hardcoded links are replaced, the track link stays
    expect(screen.queryByRole('link', { name: 'About us' })).toBeNull();
    expect(screen.getByRole('link', { name: dict('bn').footer.track })).toBeInTheDocument();
  });

  async function expectFallback() {
    expect(await fetchFooterPages()).toEqual([]);
    render(await Footer({ lang: 'en' }));
    // no hardcoded page links (they would 404); the track link stays
    expect(screen.queryByRole('link', { name: 'About us' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contact us' })).toBeNull();
    expect(screen.getByRole('link', { name: dict('en').footer.track })).toBeInTheDocument();
  }

  it('shows no page links when no page is published', async () => {
    mocks.apiGet.mockResolvedValue({ items: [] });
    await expectFallback();
  });

  it('shows no page links when the API call fails', async () => {
    // real apiGet over a failing network, so the failure is a plain rejected fetch
    const actual = await vi.importActual<typeof import('~/lib/api')>('~/lib/api');
    mocks.apiGet.mockImplementation(actual.apiGet);
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('network down')));
    try {
      await expectFallback();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
