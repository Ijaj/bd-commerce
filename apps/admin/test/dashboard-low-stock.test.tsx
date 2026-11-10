import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({ low: undefined as number | undefined }));

vi.mock('~/features/inventory/queries', () => ({ useLowStockCount: () => mocks.low }));
vi.mock('~/features/orders/queries', () => ({ useCallQueueCount: () => undefined }));
vi.mock('~/lib/auth', () => ({
  meQuery: { queryKey: ['me'], queryFn: async () => ({ name: 'Sam', permissions: [] }) },
}));
vi.mock('~/components/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: unknown }) => (
    <a href={to} data-search={JSON.stringify(search ?? null)}>
      {children}
    </a>
  ),
}));

import { Dashboard } from '~/features/shell/Dashboard';

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} env="test">
        <Dashboard />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('dashboard low-stock alert (B7)', () => {
  beforeEach(() => {
    mocks.low = undefined;
  });

  it('links the tile and the attention row to the low-stock inventory filter', () => {
    mocks.low = 4;
    show();
    const links = screen.getAllByRole('link');
    const inventory = links.filter((a) => a.getAttribute('href') === '/catalog/inventory');
    expect(inventory).toHaveLength(2);
    for (const a of inventory) expect(a.getAttribute('data-search')).toBe('{"lowStock":true}');
    expect(screen.getByText('4 variants low on stock')).toBeTruthy();
  });

  it('shows nothing about stock without inventory.view or with zero low items', () => {
    const first = show();
    expect(screen.queryByText('Low stock')).toBeNull();
    first.unmount();
    mocks.low = 0;
    show();
    expect(screen.queryByText(/low on stock/)).toBeNull();
    expect(screen.getByText('Nothing flagged')).toBeTruthy();
  });
});
