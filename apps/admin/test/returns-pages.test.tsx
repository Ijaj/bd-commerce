import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  approve: vi.fn(),
  inspect: vi.fn(),
  refunds: vi.fn(),
  refund: vi.fn(),
  approveRefund: vi.fn(),
  order: vi.fn(),
  refundOrder: vi.fn(),
}));

vi.mock('~/features/returns/api', async (orig) => ({
  ...(await orig<typeof import('~/features/returns/api')>()),
  returnsApi: mocks,
}));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('~/lib/auth', () => ({
  meQuery: { queryKey: ['me'], queryFn: async () => ({ id: 'staff-me' }) },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { OrderReturnsSection } from '~/features/returns/OrderReturnsSection';
import { RefundDetailModal } from '~/features/returns/RefundDetailModal';
import { ReturnDetailPage } from '~/features/returns/ReturnDetailPage';

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

const retDetail = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  returnNo: 'RET-2610-00001',
  status: 'requested',
  fault: null,
  returnShippingP: 0,
  note: null,
  rejectReason: null,
  staffId: null,
  requestedAt: '2026-10-25T08:00:00.000Z',
  updatedAt: '2026-10-25T08:00:00.000Z',
  order: {
    id: 'o1',
    orderNo: '2610-00001',
    status: 'delivered',
    paymentStatus: 'paid',
    deliveredAt: '2026-10-24T08:00:00.000Z',
    paidP: 200000,
    refundedP: 0,
    customerName: 'Nila',
    customerPhone: '01711111111',
  },
  items: [
    {
      id: 'ri1',
      orderItemId: 'oi1',
      titleSnapshot: 'Blue Romper',
      sku: 'BR-1',
      optionsText: null,
      imageMediaId: null,
      unitPriceP: 100000,
      qty: 2,
      reason: 'damaged',
      note: null,
      condition: null,
      restock: false,
      refundValueP: 200000,
    },
  ],
  mediaIds: [],
  refunds: [],
  ...over,
});

const refund = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  orderId: 'o1',
  returnId: 'r1',
  amountP: 200000,
  method: 'wallet',
  status: 'pending_approval',
  needsApproval: true,
  requestedBy: 'staff-other',
  requestedByName: 'Sara',
  approvedBy: null,
  approvedByName: null,
  approvedAt: null,
  providerRef: null,
  note: null,
  doneAt: null,
  createdAt: '2026-10-25T09:00:00.000Z',
  items: [],
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('ReturnDetailPage', () => {
  it('shows approve/reject for a requested return and sends the fault', async () => {
    mocks.detail.mockResolvedValue(retDetail());
    mocks.approve.mockResolvedValue(retDetail({ status: 'approved' }));
    wrap(<ReturnDetailPage id="r1" />);
    await screen.findByText('Blue Romper');
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(await screen.findByLabelText(/Customer \(change of mind\)/));
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(mocks.approve).toHaveBeenCalledWith('r1', {
        fault: 'customer',
        returnShippingP: 0,
        note: undefined,
      }),
    );
  });

  it('inspects every line and blocks restock for damaged units', async () => {
    mocks.detail.mockResolvedValue(retDetail({ status: 'received' }));
    mocks.inspect.mockResolvedValue(retDetail({ status: 'inspected' }));
    wrap(<ReturnDetailPage id="r1" />);
    await screen.findByText('Blue Romper');
    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    const restock = await screen.findByLabelText('Restock Blue Romper');
    expect(restock).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save inspection' }));
    await waitFor(() =>
      expect(mocks.inspect).toHaveBeenCalledWith('r1', {
        items: [{ returnItemId: 'ri1', condition: 'resellable', restock: true }],
      }),
    );
  });

  it('offers a refund only after inspection', async () => {
    mocks.detail.mockResolvedValue(retDetail({ status: 'inspected' }));
    wrap(<ReturnDetailPage id="r1" />);
    await screen.findByText('Blue Romper');
    expect(screen.getByRole('button', { name: 'Create refund' })).toBeInTheDocument();
  });
});

describe('RefundDetailModal', () => {
  it('disables approve on your own request and explains why', async () => {
    mocks.refund.mockResolvedValue(refund({ requestedBy: 'staff-me' }));
    wrap(<RefundDetailModal id="f1" onClose={() => {}} />);
    await screen.findByText(/another staff member has to approve/i);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText(/only recorded for now/i)).toBeInTheDocument();
  });

  it('lets another staff member approve', async () => {
    mocks.refund.mockResolvedValue(refund());
    mocks.approveRefund.mockResolvedValue(refund({ status: 'approved' }));
    wrap(<RefundDetailModal id="f1" onClose={() => {}} />);
    await screen.findByRole('button', { name: 'Approve' });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });
});

describe('OrderReturnsSection', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    orderNo: '2610-00001',
    status: 'delivered',
    money: { paidP: 200000, refundedP: 0 },
    items: [
      {
        id: 'oi1',
        titleSnapshot: 'Blue Romper',
        sku: 'BR-1',
        optionsText: null,
        qty: 2,
        qtyShipped: 2,
        qtyReturned: 0,
      },
    ],
    returns: [{ id: 'r1', returnNo: 'RET-2610-00001', status: 'requested' }],
    refunds: [{ id: 'f1', amountP: 50000, status: 'done', method: 'original' }],
    ...over,
  });

  it('lists returns and refunds with the action buttons for delivered orders', async () => {
    mocks.order.mockResolvedValue(order());
    wrap(<OrderReturnsSection orderId="o1" />);
    await screen.findByText('RET-2610-00001');
    expect(screen.getByRole('button', { name: 'Create return' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund order' })).toBeInTheDocument();
  });

  it('hides Create return before delivery', async () => {
    mocks.order.mockResolvedValue(order({ status: 'confirmed', returns: [], refunds: [] }));
    wrap(<OrderReturnsSection orderId="o1" />);
    await screen.findByText(/No returns or refunds/);
    expect(screen.queryByRole('button', { name: 'Create return' })).not.toBeInTheDocument();
  });
});
