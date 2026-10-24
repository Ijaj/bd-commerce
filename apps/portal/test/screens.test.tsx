import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, renderApp, staff, unauthorized } from './utils';

const SR = staff(['sr.portal']);
const paged = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

const meData = {
  staff: { id: 's1', name: 'Rahim Uddin' },
  profile: { area: 'Mirpur', commissionBp: 100 },
  month: {
    targetP: 100000000,
    soldP: 25000000,
    collectedP: 15000000,
    commissionP: 150000,
    dueOutstandingP: 4500000,
    month: '2026-10',
    pendingCollectionP: 0,
  },
};

const shop = {
  id: 'shop1',
  name: 'Rahman General Store',
  ownerName: 'Abdur Rahman',
  phone: '01712345678',
  address: 'Road 3',
  area: 'Mirpur, Dhaka',
  isNew: false,
  status: 'active',
  dueBalanceP: 120000,
  notes: null,
  createdBy: { id: 's1', name: 'Rahim Uddin' },
  createdAt: '2026-09-01T00:00:00Z',
};

const product = {
  variantId: 'v1',
  sku: 'RICE-5',
  titleEn: 'Rice 5kg',
  titleBn: null,
  optionsText: '',
  optionsTextBn: '',
  image: null,
  priceP: 50000,
  available: 3,
};

describe('auth + sections', () => {
  it('renders the sign-in form on /login', async () => {
    mockApi({});
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login screen', async () => {
    mockApi({ 'GET /v1/admin/auth/me': unauthorized });
    renderApp('/sr');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows "no portal access" without sr.portal', async () => {
    mockApi({ 'GET /v1/admin/auth/me': staff(['products.view']) });
    renderApp('/');
    expect(await screen.findByText('No portal access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('opens the SR section for sr.portal', async () => {
    mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/me': meData,
      'GET /v1/portal/sr/sales': paged([]),
    });
    renderApp('/');
    expect(await screen.findByText('Month target')).toBeInTheDocument();
  });
});

describe('language toggle', () => {
  it('switches the UI to Bangla, updates <html lang> and remembers it', async () => {
    mockApi({});
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    await userEvent.click(screen.getByRole('button', { name: 'বাংলা' }));
    expect(await screen.findByRole('heading', { name: 'সাইন ইন' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('bn');
    expect(localStorage.getItem('bdc_portal_lang')).toBe('bn');
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('SR home', () => {
  it('shows month figures', async () => {
    mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/me': meData,
      'GET /v1/portal/sr/sales': paged([
        {
          id: 'sale1',
          memoNo: 'SR-2610-00001',
          status: 'submitted',
          shop: { id: 'shop1', name: 'Rahman General Store', phone: '01712345678' },
          totalP: 500000,
          paidAtSaleP: 100000,
          dueP: 400000,
          note: null,
          submittedAt: '2026-10-20T08:00:00Z',
          approvedAt: null,
          rejectedReason: null,
          deliveredAt: null,
          itemCount: 1,
        },
      ]),
    });
    renderApp('/sr');
    expect(await screen.findByTestId('sold')).toHaveTextContent('৳2,50,000');
    expect(screen.getByTestId('collected')).toHaveTextContent('৳1,50,000');
    expect(screen.getByTestId('commission')).toHaveTextContent('৳1,500');
    expect(screen.getByTestId('due')).toHaveTextContent('৳45,000');
    expect(await screen.findByText('Rahman General Store')).toBeInTheDocument();
    expect(screen.getByText(/SR-2610-00001/)).toBeInTheDocument();
  });
});

describe('new sale form', () => {
  function setup() {
    return mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/sales': paged([]),
      'GET /v1/portal/sr/shops': paged([shop]),
      'GET /v1/portal/sr/products': [product],
      'POST /v1/portal/sr/sales': {
        id: 'sale9',
        memoNo: 'SR-2610-00009',
        status: 'submitted',
        shop: { id: 'shop1', name: shop.name, phone: shop.phone },
        totalP: 100000,
        paidAtSaleP: 0,
        dueP: 100000,
        submittedAt: '2026-10-24T08:00:00Z',
        items: [],
        note: null,
        rejectedReason: null,
        approvedAt: null,
        deliveredAt: null,
        itemCount: 1,
      },
    });
  }

  async function fillShopAndItem() {
    const user = userEvent.setup();
    await user.click(await screen.findByText('Rahman General Store'));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.click(await screen.findByRole('button', { name: /Rice 5kg/ }));
    return user;
  }

  it('blocks quantity above what is available', async () => {
    setup();
    renderApp('/sr/new-sale');
    const user = await fillShopAndItem();
    const qty = await screen.findByLabelText('Qty');
    await user.clear(qty);
    await user.type(qty, '5');
    expect(await screen.findByText('Only 3 available')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.queryByText('Review sale')).not.toBeInTheDocument();
  });

  it('blocks paid now above the total', async () => {
    setup();
    renderApp('/sr/new-sale');
    const user = await fillShopAndItem();
    const paid = screen.getByLabelText('Amount collected now (৳)');
    await user.type(paid, '9999');
    expect(
      await screen.findByText('Collected amount cannot be more than the total'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.queryByText('Review sale')).not.toBeInTheDocument();
  });

  it('reviews and submits a valid sale', async () => {
    const { calls } = setup();
    renderApp('/sr/new-sale');
    const user = await fillShopAndItem();
    await user.click(screen.getByRole('button', { name: 'Full amount' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Review sale')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText('Sale submitted')).toBeInTheDocument();
    expect(screen.getByText(/SR-2610-00009/)).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/v1/portal/sr/sales');
    expect(post?.body).toEqual({
      b2bShopId: 'shop1',
      items: [{ variantId: 'v1', qty: 1, unitPriceP: 50000 }],
      paidAtSaleP: 50000,
      deliveryBy: 'staff',
    });
  });

  it('sends deliveryBy=sr when the SR delivers', async () => {
    const { calls } = setup();
    renderApp('/sr/new-sale');
    const user = await fillShopAndItem();
    await user.click(screen.getByLabelText(/I deliver/));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(await screen.findByRole('button', { name: 'Submit for approval' }));
    await screen.findByText('Sale submitted');
    const post = calls.find((c) => c.method === 'POST' && c.path === '/v1/portal/sr/sales');
    expect(post?.body).toMatchObject({ deliveryBy: 'sr' });
  });

  it('shows an empty-cart error when reviewing with nothing', async () => {
    setup();
    renderApp('/sr/new-sale');
    const user = userEvent.setup();
    await screen.findByText('Rahman General Store');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Add at least one item')).toBeInTheDocument();
    expect(await screen.findByText('Choose a buyer shop')).toBeInTheDocument();
  });
});

describe('collections', () => {
  it('rejects an amount above the shop due', async () => {
    mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/sales': paged([]),
      'GET /v1/portal/sr/shops': paged([shop]),
      'GET /v1/portal/sr/collections': paged([]),
    });
    renderApp('/sr/collections?shop=shop1');
    const user = userEvent.setup();
    const amount = await screen.findByLabelText('Amount collected (৳)');
    await user.type(amount, '5000');
    await user.click(screen.getByRole('button', { name: 'Submit collection' }));
    await waitFor(() => expect(screen.getByText(/More than the shop owes/)).toBeInTheDocument());
  });
});

describe('rejected collections', () => {
  it('shows the rejection reason', async () => {
    mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/sales': paged([]),
      'GET /v1/portal/sr/shops': paged([shop]),
      'GET /v1/portal/sr/collections': paged([
        {
          id: 'c1',
          b2bShopId: 'shop1',
          shopName: 'Rahman General Store',
          type: 'collection',
          amountP: -50000,
          method: 'cash',
          confirmed: false,
          rejected: true,
          rejectReason: 'Amount does not match receipt',
          at: '2026-10-22T08:00:00Z',
        },
      ]),
    });
    renderApp('/sr/collections');
    expect(await screen.findByText('Rejected by staff')).toBeInTheDocument();
    expect(screen.getByText('Rejected: Amount does not match receipt')).toBeInTheDocument();
  });
});

describe('sale detail', () => {
  const base = {
    id: 'sale1',
    memoNo: 'SR-2610-00001',
    shop: { id: 'shop1', name: 'Rahman General Store', phone: '01712345678' },
    totalP: 100000,
    paidAtSaleP: 0,
    dueP: 100000,
    submittedAt: '2026-10-20T08:00:00Z',
    itemCount: 1,
    deliveryBy: 'staff',
    deliveredBy: null,
    approvedBy: null,
    reversedAt: null,
    reversedBy: null,
    reverseReason: null,
    items: [
      {
        id: 'i1',
        variantId: 'v1',
        sku: 'RICE-5',
        titleEn: 'Rice 5kg',
        titleBn: null,
        optionsText: '',
        optionsTextBn: '',
        qty: 2,
        unitPriceP: 50000,
        lineTotalP: 100000,
      },
    ],
    note: null,
    rejectedReason: null,
    approvedAt: null,
    deliveredAt: null,
  };

  function load(status: string, extra: Record<string, unknown> = {}) {
    mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/sales': paged([]),
      'GET /v1/portal/sr/sales/sale1': { ...base, status, ...extra },
    });
    renderApp('/sr/sales/sale1');
  }

  it('offers cancel while submitted, memo link only after approval', async () => {
    load('submitted');
    expect(await screen.findByRole('button', { name: 'Cancel this request' })).toBeInTheDocument();
    expect(screen.getByTestId('memo-no')).toHaveTextContent('SR-2610-00001');
    expect(screen.queryByRole('link', { name: 'View memo' })).not.toBeInTheDocument();
  });

  it('shows the memo link and no cancel once approved', async () => {
    load('approved');
    const link = await screen.findByRole('link', { name: 'View memo' });
    expect(link).toHaveAttribute('href', '/v1/portal/sr/sales/sale1/memo?lang=en');
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
  });

  it('lets the SR mark an own-delivery sale as delivered', async () => {
    const { calls } = (() => {
      const m = mockApi({
        'GET /v1/admin/auth/me': SR,
        'GET /v1/portal/sr/sales': paged([]),
        'GET /v1/portal/sr/sales/sale1': { ...base, status: 'approved', deliveryBy: 'sr' },
        'POST /v1/portal/sr/sales/sale1/deliver': {
          ...base,
          status: 'delivered',
          deliveryBy: 'sr',
        },
      });
      return m;
    })();
    renderApp('/sr/sales/sale1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mark as delivered' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, delivered' }));
    await waitFor(() =>
      expect(calls.some((c) => c.path === '/v1/portal/sr/sales/sale1/deliver')).toBe(true),
    );
  });

  it('hides mark-delivered when the office delivers', async () => {
    load('approved', { deliveryBy: 'staff' });
    await screen.findByRole('link', { name: 'View memo' });
    expect(screen.queryByRole('button', { name: 'Mark as delivered' })).not.toBeInTheDocument();
  });

  it('shows a reversed sale with its reason and no memo or actions', async () => {
    load('reversed', { reverseReason: 'Goods returned' });
    expect(await screen.findByText('Reversed by staff: Goods returned')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View memo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel this request' })).not.toBeInTheDocument();
  });

  it('shares the public memo link', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { calls } = mockApi({
      'GET /v1/admin/auth/me': SR,
      'GET /v1/portal/sr/sales': paged([]),
      'GET /v1/portal/sr/sales/sale1': { ...base, status: 'approved' },
      'POST /v1/portal/sr/sales/sale1/memo-link': {
        token: 'abc',
        url: 'https://shop.example/v1/public/memo/abc',
      },
    });
    renderApp('/sr/sales/sale1');
    await userEvent.click(await screen.findByRole('button', { name: 'Share memo' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const arg = share.mock.calls[0] as unknown as [{ text: string }];
    expect(arg[0].text).toContain('https://shop.example/v1/public/memo/abc?lang=en');
    expect(arg[0].text).toContain('SR-2610-00001');
    expect(calls.some((c) => c.path.endsWith('/memo-link'))).toBe(true);
    Reflect.deleteProperty(navigator, 'share');
  });
});
