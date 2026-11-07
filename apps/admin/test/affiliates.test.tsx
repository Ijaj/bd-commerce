import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { friendlyMessage } from '~/features/affiliates/errors';
import { detailLines, formatBp, payoutBody, percentToBp } from '~/features/affiliates/logic';
import { HttpError } from '~/features/categories/http';
import { visibleNav } from '~/lib/nav';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  update: vi.fn(),
  commissions: vi.fn(),
  due: vi.fn(),
  payouts: vi.fn(),
  pay: vi.fn(),
  perms: new Set<string>(),
}));

vi.mock('~/features/affiliates/api', () => ({ affiliatesApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: (...p: string[]) => p.every((x) => mocks.perms.has(x)) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { AffiliateDetailPage } from '~/features/affiliates/AffiliateDetailPage';
import { AffiliatesPage } from '~/features/affiliates/AffiliatesPage';
import { PayoutsPage } from '~/features/affiliates/PayoutsPage';

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

const customer = { id: 'c1', name: 'Tahmina Akter', phone: '01711223344', email: null };
const row = (o: object = {}) => ({
  id: 'a1',
  code: 'TAHMINA5',
  displayName: 'Tahmina Blog',
  customer,
  status: 'active',
  commissionBp: 750,
  rateOverridden: true,
  clicks30: 120,
  orders30: 9,
  pendingP: 184000,
  balanceP: 421500,
  paidP: 90000,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...o,
});
const detail = (o: object = {}) => ({
  ...row(),
  website: 'https://blog.example',
  suspendedAt: null,
  suspendedReason: null,
  payoutMethod: 'bkash',
  payoutDetails: { method: 'bkash', bkashNumber: '01711223344', holderName: 'Tahmina' },
  ...o,
});
const due = (o: object = {}) => ({
  affiliateId: 'a1',
  code: 'TAHMINA5',
  displayName: 'Tahmina Blog',
  balanceP: 421500,
  commissionCount: 3,
  payoutMethod: 'bkash',
  payoutDetails: { method: 'bkash', bkashNumber: '01711223344', holderName: 'Tahmina' },
  hasPayoutDetails: true,
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.perms = new Set();
});

describe('affiliate logic', () => {
  it('formats and parses rates', () => {
    expect(formatBp(750)).toBe('7.5%');
    expect(formatBp(500)).toBe('5%');
    expect(percentToBp('')).toBeNull();
    expect(percentToBp('7.5')).toBe(750);
    expect(percentToBp('abc')).toBe('invalid');
    expect(percentToBp('101')).toBe('invalid');
  });

  it('payout body needs a reference and drops an empty note', () => {
    expect(
      payoutBody({ method: 'bkash', reference: ' ', note: '', expectedAmountP: 100 }),
    ).toHaveProperty('error');
    expect(
      payoutBody({ method: 'bkash', reference: ' TX1 ', note: ' ', expectedAmountP: 100 }),
    ).toEqual({
      method: 'bkash',
      reference: 'TX1',
      expectedAmountP: 100,
    });
  });

  it('shows masked details as given and full details as lines', () => {
    expect(detailLines('017•••••344')).toEqual(['017•••••344']);
    expect(detailLines(null)).toEqual([]);
    expect(detailLines(detail().payoutDetails as never)).toEqual(['01711223344', 'Tahmina']);
  });

  it('rewrites known error codes', () => {
    const e = new HttpError('raw', 409, { message: 'raw', code: 'AFFILIATE_PAYOUT_CHANGED' });
    expect(friendlyMessage(e, 'x')).toMatch(/amount due changed/);
  });
});

describe('affiliate nav', () => {
  const labels = (p: string[]) => visibleNav(p).flatMap((s) => s.items.map((i) => i.label));
  it('shows Affiliates only with affiliates.view', () => {
    expect(labels([])).not.toContain('Affiliates');
    expect(labels(['affiliates.view'])).toContain('Affiliates');
  });
});

describe('AffiliatesPage', () => {
  beforeEach(() => {
    mocks.list.mockResolvedValue({
      items: [
        row(),
        row({
          id: 'a2',
          code: 'MAMAME',
          displayName: 'Mama',
          status: 'suspended',
          rateOverridden: false,
          commissionBp: 500,
        }),
      ],
      total: 2,
    });
  });

  it('lists affiliates with money, rate and status', async () => {
    wrap(<AffiliatesPage />);
    expect(await screen.findByText('Tahmina Blog')).toBeInTheDocument();
    const t = within(screen.getByRole('table'));
    expect(t.getByText('TAHMINA5')).toBeInTheDocument();
    expect(t.getAllByText('৳4,215')).toHaveLength(2);
    expect(t.getByText('Suspended')).toBeInTheDocument();
    expect(t.getByText('7.5%*')).toBeInTheDocument();
  });

  it('sends search text to the API', async () => {
    wrap(<AffiliatesPage />);
    await screen.findByText('Tahmina Blog');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'mama' } });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'mama', page: 1 })),
    );
  });

  it('shows the Payouts button only with the payout permission', async () => {
    const { unmount } = wrap(<AffiliatesPage />);
    await screen.findByText('Tahmina Blog');
    expect(screen.queryByText('Payouts')).not.toBeInTheDocument();
    unmount();
    mocks.perms = new Set(['affiliate_payouts.manage']);
    wrap(<AffiliatesPage />);
    expect(await screen.findByText('Payouts')).toBeInTheDocument();
  });
});

describe('AffiliateDetailPage', () => {
  beforeEach(() => {
    mocks.commissions.mockResolvedValue({ items: [], total: 0 });
    mocks.payouts.mockResolvedValue({ items: [], total: 0 });
  });

  it('shows full payout details and the Payouts tab with the payout permission', async () => {
    mocks.perms = new Set(['affiliate_payouts.manage']);
    mocks.detail.mockResolvedValue(detail());
    wrap(<AffiliateDetailPage id="a1" />);
    const d = await screen.findByTestId('payout-details');
    expect(d).toHaveTextContent('01711223344');
    expect(screen.getByRole('tab', { name: 'Payouts' })).toBeInTheDocument();
  });

  it('shows the masked string and no Payouts tab without it', async () => {
    mocks.detail.mockResolvedValue(detail({ payoutDetails: '017•••••344' }));
    wrap(<AffiliateDetailPage id="a1" />);
    const d = await screen.findByTestId('payout-details');
    expect(d).toHaveTextContent('017•••••344');
    expect(d).not.toHaveTextContent('01711223344');
    expect(screen.queryByRole('tab', { name: 'Payouts' })).not.toBeInTheDocument();
    expect(screen.queryByText('Edit rate / status')).not.toBeInTheDocument();
  });

  it('suspending needs a reason, then sends it', async () => {
    mocks.perms = new Set(['affiliates.manage']);
    mocks.detail.mockResolvedValue(detail());
    mocks.update.mockResolvedValue({});
    wrap(<AffiliateDetailPage id="a1" />);
    fireEvent.click(await screen.findByText('Edit rate / status'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Suspended'));
    fireEvent.click(within(dialog).getByText('Save'));
    expect(await within(dialog).findByText(/Say why/)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'fraud' } });
    fireEvent.click(within(dialog).getByText('Save'));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith('a1', {
        status: 'suspended',
        suspendedReason: 'fraud',
      }),
    );
  });
});

describe('PayoutsPage', () => {
  beforeEach(() => {
    mocks.perms = new Set(['affiliate_payouts.manage']);
    mocks.due.mockResolvedValue({ items: [due()] });
    mocks.payouts.mockResolvedValue({ items: [], total: 0 });
  });

  it('refuses without the permission', () => {
    mocks.perms = new Set();
    wrap(<PayoutsPage />);
    expect(screen.getByText(/do not have permission/)).toBeInTheDocument();
    expect(mocks.due).not.toHaveBeenCalled();
  });

  it('marks paid, sending the expected amount', async () => {
    mocks.pay.mockResolvedValue({});
    wrap(<PayoutsPage />);
    fireEvent.click(await screen.findByText('Mark paid'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Confirm paid'));
    expect(await within(dialog).findByText(/transaction reference/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Reference/), { target: { value: 'BK123' } });
    fireEvent.click(within(dialog).getByText('Confirm paid'));
    await waitFor(() =>
      expect(mocks.pay).toHaveBeenCalledWith('a1', {
        method: 'bkash',
        reference: 'BK123',
        expectedAmountP: 421500,
      }),
    );
  });

  it('explains a 409 amount mismatch, reloads the due list and closes the form', async () => {
    mocks.pay.mockRejectedValue(
      new HttpError('changed', 409, { message: 'changed', code: 'AFFILIATE_PAYOUT_CHANGED' }),
    );
    wrap(<PayoutsPage />);
    fireEvent.click(await screen.findByText('Mark paid'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reference/), { target: { value: 'BK123' } });
    fireEvent.click(within(dialog).getByText('Confirm paid'));
    expect(await screen.findByText(/amount due changed/)).toBeInTheDocument();
    await waitFor(() => expect(mocks.due).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
