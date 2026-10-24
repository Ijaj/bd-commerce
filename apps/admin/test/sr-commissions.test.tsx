import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  commissions: vi.fn(),
  adjustments: vi.fn(),
}));
vi.mock('~/features/sr/api', async (orig) => ({
  ...(await orig<typeof import('~/features/sr/api')>()),
  srApi: mocks,
}));

import { CommissionsTab } from '~/features/sr/CommissionsTab';

describe('CommissionsTab adjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summary.mockResolvedValue({ month: '2026-10', items: [] });
    mocks.commissions.mockResolvedValue({
      month: '2026-10',
      items: [
        {
          id: 'c1',
          sr: { id: 'sr1', name: 'Rafiq' },
          month: '2026-10',
          baseP: 1000000,
          commissionBp: 100,
          amountP: 8000,
          adjustmentP: 2000,
          adjustments: [
            { id: 'a1', amountP: 2000, reason: 'Sale SR-2609-00007 reversed', srSaleId: 's1' },
          ],
          status: 'pending',
          paidAt: null,
        },
      ],
    });
    mocks.adjustments.mockResolvedValue({
      items: [
        {
          id: 'a2',
          sr: { id: 'sr2', name: 'Salma' },
          srSaleId: 's2',
          memoNo: 'SR-2609-00003',
          amountP: 5000,
          reason: 'Reversed after payout',
          appliedTo: null,
          createdAt: '2026-10-20T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it('expands per-row adjustments and lists unapplied ones', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MantineProvider theme={theme} env="test">
          <CommissionsTab />
        </MantineProvider>
      </QueryClientProvider>,
    );
    const toggle = await screen.findByRole('button', { name: 'Adjustments for Rafiq' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Sale SR-2609-00007 reversed/)).toBeInTheDocument();
    expect(await screen.findByText('Reversed after payout')).toBeInTheDocument();
    expect(mocks.adjustments).toHaveBeenCalledWith('false', 1, 10);
  });
});
