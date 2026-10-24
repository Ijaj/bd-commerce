import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sortByDue, todayIso } from '~/features/b2b/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({ dues: vi.fn() }));
vi.mock('~/features/b2b/api', async (orig) => ({
  ...(await orig<typeof import('~/features/b2b/api')>()),
  b2bApi: mocks,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/shop">{children}</a>,
}));

import { DuesPage } from '~/features/b2b/DuesPage';

const item = (id: string, name: string, dueP: number, last: string | null) => ({
  shop: { id, name, phone: '017', area: null },
  dueP,
  buckets: { d0_30: dueP, d31_60: 0, d61_90: 0, d90plus: 0 },
  lastCollectionAt: last,
  srs: [{ id: 'sr1', name: 'Rafiq' }],
});

describe('dues logic', () => {
  it('sorts by due, ties by name', () => {
    const rows = [
      { dueP: 100, shop: { name: 'B' } },
      { dueP: 300, shop: { name: 'C' } },
      { dueP: 100, shop: { name: 'A' } },
    ];
    expect(sortByDue(rows).map((r) => r.shop.name)).toEqual(['C', 'A', 'B']);
    expect(sortByDue(rows, 'asc').map((r) => r.shop.name)).toEqual(['A', 'B', 'C']);
  });

  it('formats a local date', () => {
    expect(todayIso(new Date(2026, 9, 4))).toBe('2026-10-04');
  });
});

describe('DuesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dues.mockResolvedValue({
      asOf: todayIso(),
      totals: { d0_30: 100000, d31_60: 0, d61_90: 0, d90plus: 500000, dueP: 600000 },
      items: [
        item('a', 'Small Store', 100000, null),
        item('b', 'Big Store', 500000, '2026-09-30T00:00:00.000Z'),
      ],
    });
  });

  it('shows totals and rows with the biggest due first', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MantineProvider theme={theme} env="test">
          <DuesPage />
        </MantineProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('Big Store');
    const rows = screen.getAllByRole('row');
    expect(within(rows[1] as HTMLElement).getByText('Big Store')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('2026-09-30')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('৳6,000')).toBeInTheDocument();
    expect(mocks.dues).toHaveBeenCalledWith(todayIso());
  });
});
