import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allowedActions, hasMemo } from '~/features/sr/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  sales: vi.fn(),
  sale: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  deliver: vi.fn(),
  reverse: vi.fn(),
  srList: vi.fn(),
  shops: vi.fn(),
}));

vi.mock('~/features/sr/api', async (orig) => ({
  ...(await orig<typeof import('~/features/sr/api')>()),
  srApi: mocks,
}));
vi.mock('~/features/b2b/api', async (orig) => ({
  ...(await orig<typeof import('~/features/b2b/api')>()),
  b2bApi: { shops: mocks.shops },
}));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

import { SalesPage } from '~/features/sr/SalesPage';

const ref = { id: 'sr1', name: 'Rafiq' };
function sale(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    memoNo: 'SR-2610-00001',
    status: 'submitted',
    totalP: 500000,
    paidAtSaleP: 100000,
    dueP: 400000,
    note: null,
    submittedAt: '2026-10-24T08:00:00.000Z',
    approvedAt: null,
    approvedBy: null,
    rejectedReason: null,
    deliveredAt: null,
    deliveredBy: null,
    shop: { id: 'shop1', name: 'Karim Store', phone: '01711111111' },
    sr: ref,
    itemCount: 1,
    deliveryBy: 'staff',
    ...over,
  };
}
const detail = (over: Record<string, unknown> = {}) => ({
  ...sale(over),
  items: [
    {
      id: 'i1',
      variantId: 'v1',
      sku: 'TEE-M',
      titleEn: 'Linen shirt',
      titleBn: null,
      optionsText: 'M',
      optionsTextBn: '',
      qty: 2,
      unitPriceP: 250000,
      lineTotalP: 500000,
    },
  ],
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} env="test">
        <SalesPage search={{}} />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

async function openDrawer() {
  renderPage();
  fireEvent.click(await screen.findByText('SR-2610-00001'));
  return screen.findByRole('dialog');
}

describe('sale status rules', () => {
  it('offers the right actions per status', () => {
    expect(allowedActions('submitted')).toEqual(['approve', 'reject']);
    expect(allowedActions('approved')).toEqual(['deliver', 'reverse']);
    expect(allowedActions('delivered')).toEqual(['reverse']);
    expect(allowedActions('rejected')).toEqual([]);
    expect(allowedActions('reversed')).toEqual([]);
  });

  it('has a memo only after approval', () => {
    expect(hasMemo('submitted')).toBe(false);
    expect(hasMemo('approved')).toBe(true);
  });
});

describe('SalesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sales.mockResolvedValue({ items: [sale()], total: 1, page: 1, pageSize: 25 });
    mocks.sale.mockResolvedValue(detail());
    mocks.srList.mockResolvedValue([]);
    mocks.shops.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    mocks.approve.mockResolvedValue(detail({ status: 'approved' }));
    mocks.reject.mockResolvedValue(detail({ status: 'rejected' }));
  });

  it('lists sales with money and status', async () => {
    renderPage();
    expect(await screen.findByText('SR-2610-00001')).toBeInTheDocument();
    expect(screen.getByText('Karim Store')).toBeInTheDocument();
    expect(
      screen.getByText('Pending approval', { selector: '.mantine-Badge-label' }),
    ).toBeInTheDocument();
    expect(screen.getByText('৳4,000')).toBeInTheDocument();
  });

  it('shows items and totals in the drawer', async () => {
    const dialog = await openDrawer();
    expect(await within(dialog).findByText('Linen shirt')).toBeInTheDocument();
    expect(within(dialog).getByText(/Paid at sale: ৳1,000/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Due: ৳4,000/)).toBeInTheDocument();
    expect(within(dialog).queryByText('View memo')).not.toBeInTheDocument();
  });

  it('approves after confirming', async () => {
    const dialog = await openDrawer();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Approve' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    expect(mocks.approve).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith('s1'));
  });

  it('requires a reason to reject', async () => {
    const dialog = await openDrawer();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Reject' }));
    const modal = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    fireEvent.click(within(modal).getByRole('button', { name: 'Reject sale' }));
    expect(await within(modal).findByText('A reason is required')).toBeInTheDocument();
    expect(mocks.reject).not.toHaveBeenCalled();

    fireEvent.change(within(modal).getByLabelText(/Reason/), { target: { value: 'Wrong price' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Reject sale' }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith('s1', 'Wrong price'));
  });

  it('links to the memo once approved', async () => {
    mocks.sales.mockResolvedValue({
      items: [sale({ status: 'approved' })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    mocks.sale.mockResolvedValue(detail({ status: 'approved' }));
    const dialog = await openDrawer();
    const link = await within(dialog).findByRole('link', { name: 'View memo' });
    expect(link).toHaveAttribute('href', '/v1/admin/sr/sales/s1/memo?lang=en');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(dialog).getByRole('button', { name: 'Mark delivered' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Reverse' })).toBeInTheDocument();
  });
});
