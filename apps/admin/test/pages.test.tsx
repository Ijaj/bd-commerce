import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('~/features/pages/api', () => ({
  pagesApi: {
    list: mocks.list,
    get: mocks.get,
    create: mocks.create,
    update: mocks.update,
    remove: mocks.remove,
  },
}));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => mocks.navigate,
}));
// The rich-text editor is covered by its own test: a plain textarea is enough here.
vi.mock('~/components/HtmlEditor', () => ({
  HtmlEditor: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.currentTarget.value)} />
  ),
}));

import { pageToValues, validatePage, valuesToBody } from '~/features/pages/logic';
import { PageEditorPage } from '~/features/pages/PageEditorPage';
import { PagesPage } from '~/features/pages/PagesPage';

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MantineProvider theme={theme} env="test">
        {ui}
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'about',
  titleEn: 'About us',
  titleBn: null,
  isPublished: false,
  showInFooter: true,
  sortOrder: 10,
  updatedAt: '2026-11-10T00:00:00.000Z',
  ...over,
});
const full = (over: Record<string, unknown> = {}) => ({
  ...row(),
  bodyHtmlEn: '<p>Hello</p>',
  bodyHtmlBn: null,
  seoTitle: null,
  seoDescription: null,
  createdAt: '2026-11-10T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe('pages logic', () => {
  it('validates slug, title and order', () => {
    const base = pageToValues(full() as never);
    expect(validatePage(base)).toEqual({});
    expect(validatePage({ ...base, slug: 'Bad Slug' }).slug).toBeTruthy();
    expect(validatePage({ ...base, slug: 'a--b' }).slug).toBeTruthy();
    expect(validatePage({ ...base, slug: 'new' }).slug).toMatch(/reserved/);
    expect(validatePage({ ...base, slug: '' }).slug).toBeTruthy();
    expect(validatePage({ ...base, titleEn: ' ' }).titleEn).toBeTruthy();
    expect(validatePage({ ...base, sortOrder: 10000 }).sortOrder).toBeTruthy();
  });

  it('maps blanks to null in the request body', () => {
    const body = valuesToBody({ ...pageToValues(full() as never), titleBn: ' ', bodyHtmlEn: '' });
    expect(body).toMatchObject({ titleBn: null, bodyHtmlEn: null, seoTitle: null, slug: 'about' });
  });
});

describe('pages list', () => {
  it('shows status badges and publishes a draft', async () => {
    mocks.list.mockResolvedValue({
      items: [row(), row({ id: 'p2', slug: 'faq', titleEn: 'FAQ', isPublished: true })],
    });
    mocks.update.mockResolvedValue(full({ isPublished: true }));
    wrap(<PagesPage />);
    const aboutRow = (await screen.findByText('About us')).closest('tr') as HTMLElement;
    expect(within(aboutRow).getByText('Draft')).toBeTruthy();
    expect(within(aboutRow).getByText('Footer')).toBeTruthy();
    fireEvent.click(within(aboutRow).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('p1', { isPublished: true }));
    const faqRow = screen.getByText('FAQ').closest('tr') as HTMLElement;
    expect(within(faqRow).getByRole('button', { name: 'Unpublish' })).toBeTruthy();
  });

  it('deletes after confirmation', async () => {
    mocks.list.mockResolvedValue({ items: [row()] });
    mocks.remove.mockResolvedValue(undefined);
    wrap(<PagesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete About us' }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('p1'));
  });
});

describe('page editor', () => {
  it('saves edits as a PATCH with the body and bilingual fields', async () => {
    mocks.get.mockResolvedValue(full());
    mocks.update.mockResolvedValue(full({ titleEn: 'About' }));
    wrap(<PageEditorPage id="p1" />);
    const title = (await screen.findByLabelText(/Title \(English\)/)) as HTMLInputElement;
    expect(title.value).toBe('About us');
    fireEvent.change(title, { target: { value: 'About' } });
    fireEvent.change(screen.getByLabelText('Body (English)'), { target: { value: '<p>New</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save page' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0]?.[0]).toBe('p1');
    expect(mocks.update.mock.calls[0]?.[1]).toMatchObject({
      slug: 'about',
      titleEn: 'About',
      bodyHtmlEn: '<p>New</p>',
      bodyHtmlBn: null,
      isPublished: false,
      showInFooter: true,
    });
  });

  it('creates a page and blocks an invalid slug', async () => {
    mocks.create.mockResolvedValue(full({ id: 'p9', slug: 'shipping' }));
    wrap(<PageEditorPage id="new" />);
    fireEvent.change(await screen.findByLabelText(/Title \(English\)/), {
      target: { value: 'Shipping' },
    });
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'Bad Slug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    expect(await screen.findByText(/Lowercase letters/)).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Slug/), { target: { value: 'shipping' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      slug: 'shipping',
      titleEn: 'Shipping',
    });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/content/pages/$id',
        params: { id: 'p9' },
      }),
    );
  });

  it('links to the shop only when the page is published', async () => {
    mocks.get.mockResolvedValue(full({ isPublished: true }));
    wrap(<PageEditorPage id="p1" />);
    const link = await screen.findByRole('link', { name: 'View on the shop' });
    expect(link.getAttribute('href')).toMatch(/\/pages\/about$/);
  });

  it('shows no shop link for a draft', async () => {
    mocks.get.mockResolvedValue(full());
    wrap(<PageEditorPage id="p1" />);
    await screen.findByLabelText(/Title \(English\)/);
    expect(screen.queryByRole('link', { name: 'View on the shop' })).toBeNull();
  });
});
