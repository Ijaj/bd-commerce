import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CarouselSlide } from '~/features/carousel/api';
import {
  isoToLocal,
  localToIso,
  slideStatus,
  toInput,
  validateLink,
} from '~/features/carousel/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
}));

vi.mock('~/features/carousel/api', () => ({ carouselApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));

import { CarouselPage } from '~/features/carousel/CarouselPage';

const media = (id: string) => ({ id, url: `/img/${id}`, thumbUrl: `/thumb/${id}` });
const DAY = 24 * 60 * 60 * 1000;

function slide(over: Partial<CarouselSlide> & { id: string; title: string }): CarouselSlide {
  return {
    imageDesktop: media(over.id),
    imageMobile: null,
    linkUrl: null,
    startsAt: null,
    endsAt: null,
    sort: 0,
    isActive: true,
    lang: 'all',
    ...over,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} env="test">
        <CarouselPage />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('carousel logic', () => {
  it('derives the window status, inactive first', () => {
    const now = Date.now();
    const iso = (t: number) => new Date(t).toISOString();
    expect(slideStatus({ isActive: false, startsAt: null, endsAt: null }, now)).toBe('inactive');
    expect(slideStatus({ isActive: true, startsAt: iso(now + DAY), endsAt: null }, now)).toBe(
      'scheduled',
    );
    expect(slideStatus({ isActive: true, startsAt: null, endsAt: iso(now - 1) }, now)).toBe(
      'ended',
    );
    expect(
      slideStatus({ isActive: true, startsAt: iso(now - DAY), endsAt: iso(now + DAY) }, now),
    ).toBe('live');
    expect(slideStatus({ isActive: false, startsAt: iso(now + DAY), endsAt: null }, now)).toBe(
      'inactive',
    );
  });

  it('accepts relative product/category paths and https links only', () => {
    expect(validateLink('')).toBeNull();
    expect(validateLink('/p/linen-shirt')).toBeNull();
    expect(validateLink('/c/women/saree')).toBeNull();
    expect(validateLink('https://example.com/sale')).toBeNull();
    expect(validateLink('/search?q=shirt')).not.toBeNull();
    expect(validateLink('http://example.com')).not.toBeNull();
    expect(validateLink('javascript:alert(1)')).not.toBeNull();
  });

  it('converts local picker strings to ISO and back', () => {
    const local = isoToLocal(new Date(2026, 9, 24, 18, 30).toISOString());
    expect(local).toBe('2026-10-24 18:30:00');
    expect(localToIso(local)).toBe(new Date(2026, 9, 24, 18, 30).toISOString());
    expect(localToIso(null)).toBeNull();
  });

  it('builds the API body with blanks as null', () => {
    const body = toInput({
      title: ' Eid sale ',
      imageDesktopId: 'd1',
      imageMobileId: null,
      linkUrl: '  ',
      startsAt: null,
      endsAt: null,
      isActive: true,
      lang: 'bn',
    });
    expect(body).toEqual({
      title: 'Eid sale',
      imageDesktopMediaId: 'd1',
      imageMobileMediaId: null,
      linkUrl: null,
      startsAt: null,
      endsAt: null,
      isActive: true,
      lang: 'bn',
    });
  });
});

describe('CarouselPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([
      slide({ id: 's1', title: 'Eid sale', sort: 0, lang: 'bn', linkUrl: '/c/eid' }),
      slide({ id: 's2', title: 'Old banner', sort: 1, isActive: false }),
    ]);
  });

  it('lists slides with their window status', async () => {
    renderPage();
    expect(await screen.findByText('Eid sale')).toBeInTheDocument();
    expect(screen.getByText('Old banner')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText(/\/c\/eid/)).toBeInTheDocument();
  });

  it('blocks saving a new slide without a desktop image', async () => {
    renderPage();
    await screen.findByText('Eid sale');
    fireEvent.click(screen.getByRole('button', { name: 'Add slide' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Title/), { target: { value: 'New banner' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add slide' }));
    expect(await within(dialog).findByText('Desktop image is required')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('asks before deleting a slide', async () => {
    renderPage();
    await screen.findByText('Eid sale');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Eid sale' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete slide', { selector: 'h2, div' })).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
