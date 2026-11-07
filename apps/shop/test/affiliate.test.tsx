import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn(),
}));

vi.mock('~/lib/api-browser', () => ({
  browserApi: { GET: h.GET, POST: h.POST, PUT: h.PUT, DELETE: h.DELETE },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AffiliateView } from '~/features/affiliate/AffiliateView';
import { buildLink, landingFrom, payoutBody } from '~/features/affiliate/logic';
import { RefCapture } from '~/features/affiliate/RefCapture';
import type { AffiliateMe } from '~/features/affiliate/types';
import { CartView } from '~/features/cart/CartView';
import { resetCart } from '~/features/cart/store';
import { type Cart, type CartLine, EMPTY_CART } from '~/features/cart/types';
import { en } from '~/i18n/en';

const a = en.affiliate;
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const fail = (status: number, body: Record<string, unknown>) => ({
  error: { message: 'x', ...body },
  response: { ok: false, status },
});

const joined: AffiliateMe = {
  joined: true,
  id: 'a1',
  code: 'MONI11',
  displayName: "Moni's Diary",
  website: null,
  status: 'active',
  commissionBp: 500,
  payoutMethod: 'bkash',
  payoutDetailsMasked: '017•••••566',
  clickWindowDays: 30,
  minPayoutP: 50000,
  programEnabled: true,
};

const stats = {
  days: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    clicks: i,
    orders: i % 4 === 0 ? 1 : 0,
  })),
  totals: {
    clicks: 435,
    orders: 15,
    conversionBp: 345,
    pendingP: 120000,
    balanceP: 340000,
    paidP: 900000,
    reversedCount: 1,
  },
};

const commissions = {
  items: [
    {
      id: 'k1',
      placedAt: '2026-10-20T08:00:00Z',
      itemCount: 3,
      firstItemTitle: 'Blue Shirt',
      attribution: 'link',
      baseP: 200000,
      commissionBp: 500,
      amountP: 10000,
      status: 'pending',
      availableAt: '2026-10-30T08:00:00Z',
      reverseReason: null,
    },
    {
      id: 'k2',
      placedAt: '2026-10-10T08:00:00Z',
      itemCount: 1,
      firstItemTitle: 'Red Cap',
      attribution: 'code',
      baseP: 50000,
      commissionBp: 500,
      amountP: 0,
      status: 'reversed',
      availableAt: null,
      reverseReason: 'order_cancelled',
    },
  ],
  total: 2,
};

function route(over: Record<string, unknown> = {}) {
  h.GET.mockImplementation(async (path: string) => {
    if (path in over) return over[path];
    if (path === '/v1/customer/affiliate/stats') return ok(stats);
    if (path === '/v1/customer/affiliate/commissions') return ok(commissions);
    if (path === '/v1/customer/affiliate/payouts') return ok({ items: [], total: 0 });
    return ok({ items: [] });
  });
}

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  resetCart();
  route();
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('join form', () => {
  it('validates, joins and switches to the tabs', async () => {
    h.POST.mockResolvedValue(ok(joined));
    render(<AffiliateView lang="en" initial={{ joined: false }} />);
    fireEvent.click(screen.getByRole('button', { name: a.join.submit }));
    expect(h.POST).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(a.join.displayName), { target: { value: 'Moni' } });
    fireEvent.change(screen.getByLabelText(a.join.code), { target: { value: 'moni11' } });
    fireEvent.click(screen.getByRole('button', { name: a.join.submit }));
    await waitFor(() =>
      expect(h.POST).toHaveBeenCalledWith('/v1/customer/affiliate/join', {
        body: { displayName: 'Moni', code: 'MONI11' },
      }),
    );
    expect(await screen.findByRole('tab', { name: a.tabs.dash })).toBeInTheDocument();
  });

  it('shows a taken-code error on the field', async () => {
    h.POST.mockResolvedValue(fail(409, { code: 'AFFILIATE_CODE_TAKEN' }));
    render(<AffiliateView lang="en" initial={{ joined: false }} />);
    fireEvent.change(screen.getByLabelText(a.join.displayName), { target: { value: 'Moni' } });
    fireEvent.click(screen.getByRole('button', { name: a.join.submit }));
    expect(await screen.findByText(a.join.errors.AFFILIATE_CODE_TAKEN)).toBeInTheDocument();
  });

  it('turns into an info card when the programme is off', async () => {
    h.POST.mockResolvedValue(fail(409, { code: 'AFFILIATE_PROGRAM_OFF' }));
    render(<AffiliateView lang="en" initial={{ joined: false }} />);
    fireEvent.change(screen.getByLabelText(a.join.displayName), { target: { value: 'Moni' } });
    fireEvent.click(screen.getByRole('button', { name: a.join.submit }));
    expect(await screen.findByText(a.join.offTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(a.join.displayName)).toBeNull();
  });

  it('shows no form when the API already says the programme is off', () => {
    render(<AffiliateView lang="en" initial={{ joined: false, programEnabled: false }} />);
    expect(screen.getByText(a.join.offTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: a.join.submit })).toBeNull();
  });
});

describe('tabs', () => {
  it('renders dashboard stats and commission rows', async () => {
    render(<AffiliateView lang="en" initial={joined} />);
    expect(await screen.findByText('৳3,400')).toBeInTheDocument();
    expect(screen.getByText('435')).toBeInTheDocument();
    expect(screen.getByText('3.5%')).toBeInTheDocument();
    expect(await screen.findByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText(a.dash.status.pending)).toBeInTheDocument();
    expect(screen.getByText(a.dash.status.reversed)).toBeInTheDocument();
    expect(screen.getByText(a.dash.reverseReason.order_cancelled)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: a.dash.chartLabel })).toBeInTheDocument();
  });

  it('shows the suspended banner', () => {
    render(<AffiliateView lang="en" initial={{ ...joined, status: 'suspended' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(a.suspended);
  });

  it('retries a failed section', async () => {
    route({ '/v1/customer/affiliate/stats': fail(500, {}) });
    render(<AffiliateView lang="en" initial={joined} />);
    expect(await screen.findAllByText(a.dash.loadError)).not.toHaveLength(0);
  });

  it('generates a link from a path and a same-site URL, and rejects foreign ones', async () => {
    render(<AffiliateView lang="en" initial={joined} />);
    fireEvent.click(screen.getByRole('tab', { name: a.tabs.links }));
    const out = screen.getByLabelText(a.links.outLabel) as HTMLInputElement;
    const input = screen.getByLabelText(a.links.urlLabel);
    await waitFor(() => expect(out.value).toBe(`${window.location.origin}/?ref=MONI11`));
    fireEvent.change(input, { target: { value: '/p/shirt' } });
    expect(out.value).toBe(`${window.location.origin}/p/shirt?ref=MONI11`);
    fireEvent.change(input, { target: { value: `${window.location.origin}/c/men?page=2` } });
    expect(out.value).toBe(`${window.location.origin}/c/men?page=2&ref=MONI11`);
    fireEvent.change(input, { target: { value: 'https://evil.example/p/x' } });
    expect(out.value).toBe('');
    expect(screen.getByText(a.links.invalid)).toBeInTheDocument();
  });

  it('saves bKash details and shows only the masked value', async () => {
    h.PUT.mockResolvedValue(ok({ ...joined, payoutDetailsMasked: '018•••••111' }));
    render(<AffiliateView lang="en" initial={joined} />);
    fireEvent.click(screen.getByRole('tab', { name: a.tabs.details }));
    expect(screen.getByText(/017•••••566/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: a.details.save }));
    expect(h.PUT).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(a.details.bkashNumber), {
      target: { value: '+8801811111111' },
    });
    fireEvent.change(screen.getByLabelText(a.details.holderName), { target: { value: 'Monira' } });
    fireEvent.click(screen.getByRole('button', { name: a.details.save }));
    await waitFor(() =>
      expect(h.PUT).toHaveBeenCalledWith('/v1/customer/affiliate/payout-details', {
        body: { method: 'bkash', bkashNumber: '01811111111', holderName: 'Monira' },
      }),
    );
    expect(await screen.findByText(a.details.done)).toBeInTheDocument();
    expect(screen.getByText(/018•••••111/)).toBeInTheDocument();
    expect((screen.getByLabelText(a.details.bkashNumber) as HTMLInputElement).value).toBe('');
  });
});

describe('logic', () => {
  const o = 'https://shop.test';
  it('buildLink keeps same-site paths and refuses others', () => {
    expect(buildLink('', o, 'X1')).toBe('https://shop.test/?ref=X1');
    expect(buildLink('p/a', o, 'X1')).toBe('https://shop.test/p/a?ref=X1');
    expect(buildLink('https://shop.test/p/a?ref=OLD#x', o, 'X1')).toBe(
      'https://shop.test/p/a?ref=X1#x',
    );
    expect(buildLink('https://other.test/p', o, 'X1')).toBeNull();
    expect(buildLink('//other.test/p', o, 'X1')).toBeNull();
    expect(buildLink('javascript:alert(1)', o, 'X1')).toBeNull();
    expect(buildLink('/\\other.test', o, 'X1')).toBeNull();
  });
  it('landingFrom drops ref only', () => {
    expect(landingFrom('/p/a', '?ref=Z&utm_source=fb')).toBe('/p/a?utm_source=fb');
    expect(landingFrom('/', '?ref=Z')).toBe('/');
  });
  it('payoutBody validates bank accounts', () => {
    const base = {
      method: 'bank' as const,
      bkashNumber: '',
      holderName: '',
      bankName: 'DBBL',
      branch: 'Gulshan',
      accountNo: '12345',
      accountName: 'Monira',
    };
    expect(payoutBody(base).ok).toBe(false);
    const r = payoutBody({ ...base, accountNo: '1234 5678' });
    expect(r.ok && r.body.accountNo).toBe('12345678');
  });
});

describe('RefCapture', () => {
  it('posts one click and strips ref from the URL', async () => {
    h.POST.mockResolvedValue({ response: { ok: true, status: 204 } });
    window.history.replaceState(null, '', '/p/shirt?ref=MONI11&utm_source=fb&color=red');
    render(<RefCapture />);
    await waitFor(() => expect(h.POST).toHaveBeenCalledTimes(1));
    expect(h.POST).toHaveBeenCalledWith('/v1/public/affiliates/click', {
      body: {
        code: 'MONI11',
        landingUrl: '/p/shirt?utm_source=fb&color=red',
        utm: { source: 'fb' },
      },
    });
    expect(window.location.search).toBe('?utm_source=fb&color=red');
  });

  it('does nothing without ref and survives a failing call', async () => {
    render(<RefCapture />);
    expect(h.POST).not.toHaveBeenCalled();
    h.POST.mockRejectedValue(new Error('down'));
    window.history.replaceState(null, '', '/?ref=ABCD');
    render(<RefCapture />);
    await waitFor(() => expect(h.POST).toHaveBeenCalledTimes(1));
    expect(window.location.search).toBe('');
  });
});

describe('cart coupon box', () => {
  const line: CartLine = {
    variantId: 'v1',
    productId: 'p1',
    slug: 'shirt',
    titleEn: 'Blue Shirt',
    titleBn: null,
    optionsTextEn: null,
    optionsTextBn: null,
    image: null,
    qty: 1,
    unitPriceP: 150000,
    compareAtP: null,
    priceAtAddP: 150000,
    priceChanged: false,
    available: 9,
    maxQty: 9,
    problem: null,
    flashEndsAt: null,
    discountP: 0,
  };
  const cart: Cart = {
    ...EMPTY_CART,
    items: [line],
    count: 1,
    subtotalP: 150000,
    affiliate: { code: 'MONI11', displayName: "Moni's Diary" },
  };

  it('shows the referral chip and removes it', async () => {
    h.DELETE.mockResolvedValue(ok({ ...cart, affiliate: null }));
    render(<CartView lang="en" initial={cart} />);
    expect(screen.getByText("Referred by Moni's Diary (MONI11)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove referral MONI11' }));
    await waitFor(() => expect(h.DELETE).toHaveBeenCalledWith('/v1/cart/affiliate-code'));
    await waitFor(() => expect(screen.queryByText(/Referred by/)).toBeNull());
  });
});
