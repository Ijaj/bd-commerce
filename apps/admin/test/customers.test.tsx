import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '~/features/categories/http';
import { friendlyMessage } from '~/features/customers/errors';
import { averageOrderP, flag, initials } from '~/features/customers/logic';
import { visibleNav } from '~/lib/nav';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  orders: vi.fn(),
  notes: vi.fn(),
  addNote: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  perms: new Set<string>(),
}));

vi.mock('~/features/customers/api', () => ({ customersApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: (...p: string[]) => p.every((x) => mocks.perms.has(x)) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { CustomerDetailPage } from '~/features/customers/CustomerDetailPage';
import { CustomersPage } from '~/features/customers/CustomersPage';

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

const row = (o: object = {}) => ({
  id: 'c1',
  name: 'Alice Khan',
  phone: '01711000001',
  email: 'alice@example.com',
  lang: 'en',
  createdAt: '2026-10-01T00:00:00.000Z',
  lastLoginAt: null,
  blocked: false,
  orderCount: 2,
  spentP: 250000,
  lastOrderAt: '2026-11-01T00:00:00.000Z',
  ...o,
});
const detail = (o: object = {}) => ({
  ...row(),
  phoneVerifiedAt: '2026-10-01T00:00:00.000Z',
  emailVerifiedAt: null,
  isFlagged: false,
  blockedAt: null,
  blockedReason: null,
  blockedBy: null,
  cancelledCount: 1,
  addresses: [
    {
      id: 'a1',
      label: 'Home',
      name: 'Alice',
      phone: '01711000001',
      placeText: 'Gulshan, Dhaka',
      line: 'House 5',
      landmark: null,
      isDefault: true,
    },
  ],
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.perms = new Set();
  mocks.list.mockResolvedValue({ items: [row()], total: 45 });
  mocks.orders.mockResolvedValue({
    items: [
      {
        id: 'o1',
        orderNo: '2611-00001',
        placedAt: '2026-11-01T00:00:00.000Z',
        status: 'processing',
        paymentStatus: 'unpaid',
        grandTotalP: 125000,
        itemCount: 2,
      },
    ],
    total: 1,
  });
  mocks.notes.mockResolvedValue({
    items: [
      {
        id: 'n1',
        staff: { id: 's1', name: 'Rina' },
        body: 'Prefers calls after 6pm',
        createdAt: '2026-11-02T00:00:00.000Z',
      },
    ],
  });
});

describe('customers logic', () => {
  it('builds initials, flags and averages', () => {
    expect(initials('alice khan')).toBe('AK');
    expect(initials('  ')).toBe('?');
    expect(flag('any')).toBeUndefined();
    expect(flag('1')).toBe('1');
    expect(averageOrderP(0, 0)).toBe(0);
    expect(averageOrderP(3, 1000)).toBe(333);
  });

  it('maps error codes to friendly text', () => {
    const e = new HttpError('x', 409, { code: 'CUSTOMER_ALREADY_BLOCKED' });
    expect(friendlyMessage(e, 'f')).toContain('already blocked');
    expect(friendlyMessage(new Error('boom'), 'f')).toBe('boom');
  });

  it('shows the nav entry only with customers.view', () => {
    const labels = (p: string[]) => visibleNav(p).flatMap((s) => s.items.map((i) => i.label));
    expect(labels(['customers.view'])).toContain('Customers');
    expect(labels(['orders.view'])).not.toContain('Customers');
  });
});

describe('customers list', () => {
  it('renders rows and sends search and filters to the server', async () => {
    wrap(<CustomersPage />);
    expect(await screen.findByText('Alice Khan')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: ' alice ' } });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, q: 'alice' }),
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Blocked' }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        q: 'alice',
        blocked: '1',
      }),
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Orders' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Has orders' }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        q: 'alice',
        blocked: '1',
        hasOrders: '1',
      }),
    );
  });

  it('pages on the server', async () => {
    wrap(<CustomersPage />);
    await screen.findByText('Alice Khan');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 }));
  });

  it('marks blocked customers', async () => {
    mocks.list.mockResolvedValue({ items: [row({ blocked: true })], total: 1 });
    wrap(<CustomersPage />);
    expect(await screen.findByText('Blocked', { selector: 'span.a-badge' })).toBeTruthy();
  });
});

describe('customer profile', () => {
  it('shows details, stats, orders tab and addresses', async () => {
    mocks.detail.mockResolvedValue(detail());
    wrap(<CustomerDetailPage id="c1" />);
    expect(await screen.findByText('01711000001')).toBeTruthy();
    expect(screen.getByText('Total spent')).toBeTruthy();
    expect(await screen.findByText('#2611-00001')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Addresses/ }));
    expect(screen.getByText('Gulshan, Dhaka')).toBeTruthy();
  });

  it('hides block and note controls without customers.manage', async () => {
    mocks.detail.mockResolvedValue(detail());
    wrap(<CustomerDetailPage id="c1" />);
    await screen.findByText('Total spent');
    expect(screen.queryByRole('button', { name: 'Block customer' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(await screen.findByText('Prefers calls after 6pm')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
  });

  it('blocks with a required reason', async () => {
    mocks.perms = new Set(['customers.manage']);
    mocks.detail.mockResolvedValue(detail());
    mocks.block.mockResolvedValue(detail({ blocked: true }));
    wrap(<CustomerDetailPage id="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Block customer' }));
    const submit = await screen.findAllByRole('button', { name: 'Block customer' });
    fireEvent.click(submit[submit.length - 1] as HTMLElement);
    expect(await screen.findByText('Say why you are blocking this customer.')).toBeTruthy();
    expect(mocks.block).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Fake orders' } });
    const again = screen.getAllByRole('button', { name: 'Block customer' });
    fireEvent.click(again[again.length - 1] as HTMLElement);
    await waitFor(() => expect(mocks.block).toHaveBeenCalledWith('c1', 'Fake orders'));
  });

  it('shows the block banner and unblocks', async () => {
    mocks.perms = new Set(['customers.manage']);
    mocks.detail.mockResolvedValue(
      detail({
        blocked: true,
        blockedAt: '2026-11-05T00:00:00.000Z',
        blockedReason: 'Fake orders',
        blockedBy: { id: 's1', name: 'Rina' },
      }),
    );
    mocks.unblock.mockResolvedValue(detail());
    wrap(<CustomerDetailPage id="c1" />);
    expect(await screen.findByText(/Fake orders/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    const btns = await screen.findAllByRole('button', { name: 'Unblock' });
    fireEvent.click(btns[btns.length - 1] as HTMLElement);
    await waitFor(() => expect(mocks.unblock).toHaveBeenCalledWith('c1'));
  });

  it('adds a note and offers no edit or delete', async () => {
    mocks.perms = new Set(['customers.manage']);
    mocks.detail.mockResolvedValue(detail());
    mocks.addNote.mockResolvedValue({});
    wrap(<CustomerDetailPage id="c1" />);
    await screen.findByText('Total spent');
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    await screen.findByText('Prefers calls after 6pm');
    expect(screen.queryByRole('button', { name: /edit|delete/i })).toBeNull();
    fireEvent.change(screen.getByLabelText(/New note/), { target: { value: 'Called, ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(mocks.addNote).toHaveBeenCalledWith('c1', 'Called, ok'));
  });
});
