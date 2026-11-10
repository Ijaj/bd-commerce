import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEditBody,
  canEditOrder,
  describeEdit,
  initialDraft,
} from '~/features/orders/edit-logic';
import type { OrderDetail } from '~/features/orders/queries';
import { renderWithMantine } from './utils';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  couriers: vi.fn(),
  editPreview: vi.fn(),
  edit: vi.fn(),
  edits: vi.fn(),
  searchVariants: vi.fn(),
  districts: vi.fn(),
  upazilas: vi.fn(),
  zones: vi.fn(),
  perms: ['orders.view', 'orders.manage', 'orders.edit'] as string[],
}));
vi.mock('~/features/orders/api', async (orig) => ({
  ...(await orig<typeof import('~/features/orders/api')>()),
  ordersApi: mocks,
}));
vi.mock('~/features/delivery/api', () => ({ deliveryApi: { list: mocks.zones } }));
vi.mock('~/lib/perm', () => ({
  useCan: (...p: string[]) => p.every((x) => mocks.perms.includes(x)),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

import { OrderActions } from '~/features/orders/OrderActions';
import { OrderEditModal } from '~/features/orders/OrderEditModal';
import { OrderEditsCard } from '~/features/orders/OrderEditsCard';
import { OrdersListPage } from '~/features/orders/OrdersListPage';

const wrap = (ui: React.ReactElement) =>
  renderWithMantine(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );

const order = (over: Partial<OrderDetail> = {}) =>
  ({
    id: 'o1',
    orderNo: '2610-00001',
    status: 'processing',
    shipments: [],
    call: { status: 'not_needed', note: null, staffName: null, at: null },
    items: [
      {
        id: 'i1',
        variantId: 'v1',
        titleSnapshot: 'Blue Mug',
        optionsText: null,
        sku: 'MUG-1',
        qty: 3,
        qtyCancelled: 0,
        unitPriceP: 100000,
      },
    ],
    shipTo: {
      name: 'Karim',
      phone: '01811111111',
      placeText: 'Gulshan, Dhaka',
      line: 'Road 1',
      landmark: null,
      districtId: 47,
      upazilaId: 1,
      areaId: null,
    },
    ...over,
  }) as unknown as OrderDetail;

const money = (grand: number) => ({
  subtotalP: grand,
  autoDiscountP: 0,
  couponDiscountP: 0,
  deliveryChargeP: 0,
  deliveryDiscountP: 0,
  grandTotalP: grand,
  codDueP: grand,
});
const preview = (over: Record<string, unknown> = {}) => ({
  lines: [
    {
      orderItemId: 'i1',
      variantId: 'v1',
      title: 'Blue Mug',
      sku: 'MUG-1',
      optionsText: null,
      qty: 1,
      unitPriceP: 100000,
      lineTotalP: 100000,
      discountP: 0,
      change: 'qty',
    },
  ],
  money: money(100000),
  before: money(300000),
  zone: { id: 'z1', name: 'Inside Dhaka' },
  warnings: [],
  ...over,
});

describe('edit logic', () => {
  it('is editable only while open and nothing is booked or sent', () => {
    expect(canEditOrder(order())).toBe(true);
    expect(canEditOrder(order({ status: 'on_hold' }))).toBe(true);
    expect(canEditOrder(order({ status: 'shipped' }))).toBe(false);
    expect(canEditOrder(order({ status: 'delivered' }))).toBe(false);
    expect(canEditOrder(order({ shipments: [{ status: 'booked' }] as never }))).toBe(false);
    expect(canEditOrder(order({ shipments: [{ status: 'ready' }] as never }))).toBe(true);
    expect(canEditOrder(order({ shipments: [{ status: 'cancelled' }] as never }))).toBe(true);
  });

  it('sends only what changed', () => {
    const o = order();
    const d = initialDraft(o);
    expect(buildEditBody(d, o)).toEqual({});
    d.lines = d.lines.map((l) => ({ ...l, qty: 2 }));
    d.ship.line = 'Road 9';
    d.ship.upazilaId = '77';
    d.note = ' why ';
    expect(buildEditBody(d, o)).toEqual({
      lines: [{ orderItemId: 'i1', qty: 2 }],
      ship: { line: 'Road 9', upazilaId: 77 },
      note: 'why',
    });
    const removed = initialDraft(o);
    removed.lines = [];
    expect(buildEditBody(removed, o).lines).toEqual([]);
  });

  it('summarises an edit from its snapshots', () => {
    const line = (qty: number, unitPriceP = 100) => ({
      variantId: 'v1',
      title: 'Mug',
      qty,
      unitPriceP,
      lineTotalP: qty * unitPriceP,
      discountP: 0,
    });
    const ship = {
      placeText: 'A',
      zoneName: 'Z1',
      name: 'n',
      phone: 'p',
      line: 'l',
      landmark: null,
    };
    const facts = describeEdit({
      before: { lines: [line(3)], ship } as never,
      after: { lines: [line(1), line(2, 120)], ship: { ...ship, zoneName: 'Z2' } } as never,
    });
    expect(facts).toEqual(['Mug: 3 to 1', 'Added 2 x Mug', 'Zone: Z1 to Z2']);
  });
});

describe('order list filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    mocks.couriers.mockResolvedValue([
      { id: 'c1', code: 'steadfast', name: 'Steadfast', isActive: true },
    ]);
    mocks.zones.mockResolvedValue([{ id: 'z1', nameEn: 'Inside Dhaka' }]);
  });

  it('sends courier, zone, payment method and source', async () => {
    wrap(<OrdersListPage />);
    await waitFor(() => expect(mocks.couriers).toHaveBeenCalled());
    const pick = async (label: string, option: string) => {
      await userEvent.click(screen.getByRole('combobox', { name: label }));
      await userEvent.click(await screen.findByRole('option', { name: option }));
    };
    await pick('Courier', 'Steadfast');
    await pick('Zone', 'Inside Dhaka');
    await pick('Payment method', 'Cash on delivery');
    await pick('Source', 'Guest checkout');
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          courierId: 'c1',
          zoneId: 'z1',
          paymentMethod: 'cod',
          source: 'guest',
        }),
      ),
    );
  });
});

describe('Edit order button', () => {
  beforeEach(() => {
    mocks.perms = ['orders.view', 'orders.manage', 'orders.edit'];
  });

  it('shows for editable orders with orders.edit only', () => {
    const { unmount } = wrap(<OrderActions order={order()} />);
    expect(screen.getByRole('button', { name: 'Edit order' })).toBeInTheDocument();
    unmount();
    const booked = wrap(
      <OrderActions order={order({ shipments: [{ status: 'booked' }] as never })} />,
    );
    expect(screen.queryByRole('button', { name: 'Edit order' })).toBeNull();
    booked.unmount();
    mocks.perms = ['orders.view', 'orders.manage'];
    wrap(<OrderActions order={order()} />);
    expect(screen.queryByRole('button', { name: 'Edit order' })).toBeNull();
  });
});

describe('OrderEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editPreview.mockResolvedValue(preview());
    mocks.edit.mockResolvedValue({});
    mocks.edits.mockResolvedValue({ items: [] });
    mocks.districts.mockResolvedValue([{ id: 47, nameEn: 'Dhaka' }]);
    mocks.upazilas.mockResolvedValue([{ id: 1, nameEn: 'Gulshan' }]);
  });

  it('previews new totals live, shows warnings, and saves the changes with the reason', async () => {
    mocks.editPreview.mockResolvedValue(
      preview({ warnings: ['Coupon BIG20 no longer applies (MIN_ORDER) and was removed.'] }),
    );
    const onClose = vi.fn();
    wrap(<OrderEditModal order={order()} opened onClose={onClose} />);
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(screen.getByText('Change something to see the new totals.')).toBeInTheDocument();

    const qty = screen.getByLabelText('Quantity of Blue Mug');
    fireEvent.change(qty, { target: { value: '1' } });
    await waitFor(() =>
      expect(mocks.editPreview).toHaveBeenLastCalledWith('o1', {
        lines: [{ orderItemId: 'i1', qty: 1 }],
      }),
    );
    expect(
      await screen.findByText('Coupon BIG20 no longer applies (MIN_ORDER) and was removed.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Qty changed')).toBeInTheDocument();
    expect(screen.getAllByText('৳3,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('৳1,000').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText(/Reason/), 'Customer asked');
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith('o1', {
        lines: [{ orderItemId: 'i1', qty: 1 }],
        note: 'Customer asked',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('disables Save when the preview fails, and refuses an emptied order', async () => {
    mocks.editPreview.mockRejectedValue(new Error('Not enough stock.'));
    wrap(<OrderEditModal order={order()} opened onClose={() => {}} />);
    const qty = screen.getByLabelText('Quantity of Blue Mug');
    fireEvent.change(qty, { target: { value: '9' } });
    expect(await screen.findByText('Not enough stock.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Blue Mug' }));
    expect(await screen.findByText(/Cancel the order instead/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
});

describe('OrderEditsCard', () => {
  it('lists edits newest first with totals and what changed', async () => {
    const ship = {
      placeText: 'A',
      zoneName: 'Z1',
      name: 'n',
      phone: 'p',
      line: 'l',
      landmark: null,
    };
    const snap = (qty: number, grand: number) => ({
      ship,
      lines: [
        {
          variantId: 'v1',
          title: 'Mug',
          qty,
          unitPriceP: 100,
          lineTotalP: qty * 100,
          discountP: 0,
        },
      ],
      money: money(grand),
      discounts: [],
    });
    mocks.edits.mockResolvedValue({
      items: [
        {
          id: 'e1',
          createdAt: '2026-11-10T05:00:00.000Z',
          staff: { id: 's1', name: 'Owner One' },
          note: 'Customer asked',
          customerNotifiedAt: null,
          before: snap(3, 300000),
          after: snap(1, 100000),
        },
      ],
    });
    wrap(<OrderEditsCard orderId="o1" />);
    expect(await screen.findByText('Mug: 3 to 1')).toBeInTheDocument();
    expect(screen.getByText('৳3,000 to ৳1,000')).toBeInTheDocument();
    expect(screen.getByText(/Owner One/)).toBeInTheDocument();
    expect(screen.getByText(/Customer asked/)).toBeInTheDocument();
  });
});
