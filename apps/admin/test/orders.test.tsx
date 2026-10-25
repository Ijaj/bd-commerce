import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { availableActions, cancelBlockedReason, riskColor } from '~/features/orders/logic';
import type { OrderDetail } from '~/features/orders/queries';
import { renderWithMantine } from './utils';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  callQueue: vi.fn(),
  call: vi.fn(),
  cancel: vi.fn(),
  perms: ['orders.view', 'orders.manage', 'orders.call'] as string[],
}));
vi.mock('~/features/orders/api', async (orig) => ({
  ...(await orig<typeof import('~/features/orders/api')>()),
  ordersApi: mocks,
}));
vi.mock('~/lib/perm', () => ({
  useCan: (...p: string[]) => p.every((x) => mocks.perms.includes(x)),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

import { CallQueuePage } from '~/features/orders/CallQueuePage';
import { OrderActions } from '~/features/orders/OrderActions';
import { OrdersListPage } from '~/features/orders/OrdersListPage';

const wrap = (ui: React.ReactElement) =>
  renderWithMantine(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );

const listItem = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNo: '2610-00001',
  placedAt: '2026-10-24T05:00:00.000Z',
  status: 'processing',
  paymentStatus: 'unpaid',
  callStatus: 'pending',
  riskScore: 20,
  riskReasons: ['first_guest', 'cod_high'],
  callNote: null,
  callAt: null,
  customer: { id: null, name: 'Rina', phone: '01711000000', isGuest: true },
  shipPlaceText: 'Mirpur, Dhaka',
  grandTotalP: 125000,
  codDueP: 125000,
  itemCount: 2,
  shipmentSummary: { total: 0, delivered: 0 },
  ...over,
});

const detail = (over: Partial<OrderDetail> = {}) =>
  ({
    id: 'o1',
    orderNo: '2610-00001',
    status: 'processing',
    shipments: [],
    call: { status: 'not_needed', note: null, staffName: null, at: null },
    ...over,
  }) as OrderDetail;

describe('order logic', () => {
  it('offers hold on processing, resume on hold, call when pending', () => {
    expect(availableActions(detail()).hold).toBe(true);
    expect(availableActions(detail({ status: 'on_hold' }))).toMatchObject({
      hold: false,
      resume: true,
      cancel: true,
    });
    expect(availableActions(detail({ call: { status: 'pending' } as never })).call).toBe(true);
  });

  it('does not offer cancel once a shipment left the warehouse or the order is final', () => {
    const sent = detail({ shipments: [{ status: 'handed_over' }] as never });
    expect(availableActions(sent).cancel).toBe(false);
    expect(availableActions(detail({ status: 'cancelled' })).cancel).toBe(false);
  });

  it('explains a booked shipment blocks cancel', () => {
    const booked = detail({ shipments: [{ status: 'booked' }] as never });
    expect(cancelBlockedReason(booked)).toMatch(/Cancel the shipment first/);
    expect(cancelBlockedReason(detail())).toBeNull();
  });

  it('escalates risk colour', () => {
    expect([10, 20, 30].map(riskColor)).toEqual(['yellow', 'orange', 'red']);
  });
});

describe('OrdersListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [listItem()], total: 1, page: 1, pageSize: 25 });
  });

  it('lists orders with badges and sends filters to the API', async () => {
    wrap(<OrdersListPage />);
    await screen.findByText('2610-00001');
    expect(screen.getByText('Rina (guest)')).toBeInTheDocument();
    expect(screen.getByText('Risk 20')).toBeInTheDocument();
    expect(screen.getAllByText('Call pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('৳1,250').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText('Search'), '0171');
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '0171', page: 1, pageSize: 25 }),
      ),
    );
  });
});

describe('CallQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.perms = ['orders.call'];
    mocks.callQueue.mockResolvedValue({ items: [listItem()], total: 1, page: 1, pageSize: 25 });
    mocks.call.mockResolvedValue({});
  });

  it('records an outcome with a note', async () => {
    wrap(<CallQueuePage />);
    await screen.findByText('2610-00001');
    expect(screen.getByText(/First guest order, High COD amount/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unreachable' }));
    await userEvent.type(await screen.findByLabelText('Note'), 'no answer twice');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mocks.call).toHaveBeenCalledWith('o1', 'unreachable', 'no answer twice'),
    );
  });

  it('blocks staff without orders.call', async () => {
    mocks.perms = ['orders.view'];
    wrap(<CallQueuePage />);
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument();
    expect(mocks.callQueue).not.toHaveBeenCalled();
  });
});

describe('OrderActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.perms = ['orders.view', 'orders.manage', 'orders.call'];
    mocks.cancel.mockResolvedValue({});
  });

  it('disables cancel while a shipment is booked', () => {
    wrap(<OrderActions order={detail({ shipments: [{ status: 'booked' }] as never })} />);
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeDisabled();
  });

  it('requires a reason to cancel', async () => {
    wrap(<OrderActions order={detail()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'customer asked');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('o1', 'customer asked'));
  });

  it('hides management actions without orders.manage', () => {
    mocks.perms = ['orders.view'];
    wrap(<OrderActions order={detail()} />);
    expect(screen.queryByRole('button', { name: 'Put on hold' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
  });
});
