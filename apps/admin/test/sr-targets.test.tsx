import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  achievedPercent,
  bpToPercent,
  changedTargets,
  currentMonth,
  formatPercent,
  percentToBp,
} from '~/features/sr/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  targets: vi.fn(),
  summary: vi.fn(),
  setTargets: vi.fn(),
}));

vi.mock('~/features/sr/api', async (orig) => ({
  ...(await orig<typeof import('~/features/sr/api')>()),
  srApi: mocks,
}));

import { TargetsTab } from '~/features/sr/TargetsTab';

describe('sr logic', () => {
  it('formats the month and percentages', () => {
    expect(currentMonth(new Date(2026, 9, 24))).toBe('2026-10');
    expect(percentToBp('')).toBeNull();
    expect(percentToBp(1.25)).toBe(125);
    expect(bpToPercent(100)).toBe(1);
    expect(formatPercent(100)).toBe('1%');
    expect(formatPercent(125)).toBe('1.25%');
    expect(achievedPercent(50000, 100000)).toBe(50);
    expect(achievedPercent(50000, null)).toBeNull();
  });

  it('collects only changed targets; cleared saves as 0', () => {
    const rows = [
      { srStaffId: 'a', targetP: 100000 },
      { srStaffId: 'b', targetP: null },
      { srStaffId: 'c', targetP: 50000 },
    ];
    expect(changedTargets(rows, { a: 100000, b: 200000, c: null })).toEqual([
      { srStaffId: 'b', targetP: 200000 },
      { srStaffId: 'c', targetP: 0 },
    ]);
    expect(changedTargets(rows, {})).toEqual([]);
  });
});

describe('TargetsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.targets.mockResolvedValue({
      month: currentMonth(),
      items: [
        { srStaffId: 'a', name: 'Rafiq', targetP: 1000000 },
        { srStaffId: 'b', name: 'Salma', targetP: null },
      ],
    });
    mocks.summary.mockResolvedValue({
      month: currentMonth(),
      items: [{ srStaffId: 'a', name: 'Rafiq', soldP: 500000, targetP: 1000000 }],
    });
    mocks.setTargets.mockResolvedValue({});
  });

  it('saves only the edited row', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MantineProvider theme={theme} env="test">
          <TargetsTab />
        </MantineProvider>
      </QueryClientProvider>,
    );
    const input = await screen.findByLabelText('Target for Salma');
    expect(screen.getByRole('button', { name: 'Save targets' })).toBeDisabled();
    expect(screen.getByText('50%')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save targets' }));
    await waitFor(() =>
      expect(mocks.setTargets).toHaveBeenCalledWith(currentMonth(), [
        { srStaffId: 'b', targetP: 2500000 },
      ]),
    );
  });
});
