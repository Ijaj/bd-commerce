import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { friendlyMessage } from '~/features/b2b/errors';
import { ledgerState, signedAdjustment } from '~/features/b2b/logic';
import { HttpError } from '~/features/categories/http';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  adjust: vi.fn(),
  collections: vi.fn(),
  confirmCollection: vi.fn(),
  rejectCollection: vi.fn(),
}));

vi.mock('~/features/b2b/api', async (orig) => ({
  ...(await orig<typeof import('~/features/b2b/api')>()),
  b2bApi: mocks,
}));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { AdjustModal } from '~/features/b2b/AdjustModal';
import { CollectionsPage } from '~/features/b2b/CollectionsPage';

const shop = {
  id: 'shop1',
  name: 'Karim Store',
  ownerName: null,
  phone: '01711111111',
  address: 'Mirpur',
  area: null,
  isNew: false,
  status: 'active' as const,
  dueBalanceP: 400000,
  notes: null,
  createdBy: { id: 'sr1', name: 'Rafiq' },
  createdAt: '2026-10-01T00:00:00.000Z',
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} env="test">
        <Notifications />
        {ui}
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('adjustment logic', () => {
  it('signs by direction and requires amount and note', () => {
    expect(signedAdjustment('increase', 5000, ' fee ')).toEqual({ amountP: 5000, note: 'fee' });
    expect(signedAdjustment('reduce', 5000, 'discount')).toEqual({
      amountP: -5000,
      note: 'discount',
    });
    expect(signedAdjustment('increase', null, 'x')).toHaveProperty('error');
    expect(signedAdjustment('increase', 0, 'x')).toHaveProperty('error');
    expect(signedAdjustment('increase', 100, '  ')).toHaveProperty('error');
  });

  it('derives the collection state', () => {
    const row = (o: object) => ({ type: 'collection', confirmed: false, ...o }) as never;
    expect(ledgerState(row({}))).toBe('pending');
    expect(ledgerState(row({ confirmed: true }))).toBe('confirmed');
    expect(ledgerState(row({ rejected: true }))).toBe('rejected');
    expect(ledgerState({ type: 'sale_due', confirmed: true } as never)).toBe('posted');
  });
});

describe('error messages', () => {
  it('rewrites known codes and keeps others', () => {
    const err = (code: string, msg = 'raw') => new HttpError(msg, 403, { message: msg, code });
    expect(friendlyMessage(err('SELF_CONFIRM'), 'x')).toMatch(/someone else/);
    expect(friendlyMessage(err('LEDGER_OVERFLOW'), 'x')).toMatch(/limit/);
    expect(friendlyMessage(err('TOO_MANY_OPEN_SALES'), 'x')).toMatch(/waiting for approval/);
    expect(friendlyMessage(err('OTHER', 'Plain'), 'x')).toBe('Plain');
    expect(friendlyMessage('nope', 'fallback')).toBe('fallback');
  });
});

describe('AdjustModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adjust.mockResolvedValue({});
  });

  it('blocks an empty amount or note', async () => {
    wrap(<AdjustModal shop={shop} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
    expect(await within(dialog).findByText('Enter an amount above zero')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
    expect(await within(dialog).findByText('A note is required')).toBeInTheDocument();
    expect(mocks.adjust).not.toHaveBeenCalled();
  });

  it('confirms a reduction as a negative amount', async () => {
    wrap(<AdjustModal shop={shop} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Reduce due'));
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '50' } });
    fireEvent.change(within(dialog).getByLabelText(/^Note/), { target: { value: 'Goodwill' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
    expect(await within(dialog).findByText('৳3,950')).toBeInTheDocument();
    expect(mocks.adjust).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Post adjustment' }));
    await waitFor(() =>
      expect(mocks.adjust).toHaveBeenCalledWith('shop1', { amountP: -5000, note: 'Goodwill' }),
    );
  });
});

describe('CollectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collections.mockResolvedValue({
      items: [
        {
          id: 'l1',
          b2bShopId: 'shop1',
          shopName: 'Karim Store',
          type: 'collection',
          amountP: -150000,
          method: 'cash',
          srSaleId: null,
          memoNo: null,
          recordedBy: { id: 'sr1', name: 'Rafiq' },
          confirmed: false,
          confirmedBy: null,
          confirmedAt: null,
          note: null,
          at: '2026-10-24T08:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    mocks.confirmCollection.mockResolvedValue({});
    mocks.rejectCollection.mockResolvedValue({});
  });

  it('confirms a pending collection', async () => {
    wrap(<CollectionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mocks.confirmCollection).toHaveBeenCalledWith('l1'));
  });

  it('explains a self-confirm refusal', async () => {
    mocks.confirmCollection.mockRejectedValue(
      new HttpError('You cannot confirm your own collection', 403, { code: 'SELF_CONFIRM' }),
    );
    wrap(<CollectionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mocks.confirmCollection).toHaveBeenCalled());
    expect(await screen.findByText(/someone else has to confirm/)).toBeInTheDocument();
  });

  it('rejects with a reason', async () => {
    wrap(<CollectionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'No cash' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(mocks.rejectCollection).toHaveBeenCalledWith('l1', 'No cash'));
  });
});
