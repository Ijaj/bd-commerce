import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('~/lib/api-browser', () => ({ browserApi: { GET: h.GET, POST: h.POST } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetSession } from '~/features/account/session';
import { resetCart } from '~/features/cart/store';
import type { Cart } from '~/features/cart/types';
import { EMPTY_ADDRESS, validateAddress } from '~/features/checkout/address';
import { CheckoutForm } from '~/features/checkout/CheckoutForm';
import {
  cartNoticeFor,
  checkoutError,
  recallPlaced,
  rememberPlaced,
} from '~/features/checkout/errors';
import { resetGeo } from '~/features/checkout/geo';
import { SuccessView } from '~/features/checkout/SuccessView';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';

const d = en.checkout;
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const fail = (status: number, code?: string) => ({
  error: { code, message: 'x' },
  response: { ok: false, status },
});

const cart: Cart = {
  items: [
    {
      variantId: 'v1',
      productId: 'p1',
      slug: 'shirt',
      titleEn: 'Blue Shirt',
      titleBn: null,
      optionsTextEn: null,
      optionsTextBn: null,
      image: null,
      qty: 2,
      unitPriceP: 150000,
      compareAtP: null,
      priceAtAddP: 150000,
      priceChanged: false,
      available: 9,
      maxQty: 9,
      problem: null,
      flashEndsAt: null,
      discountP: 0,
    },
  ],
  count: 2,
  subtotalP: 300000,
  discountP: 0,
  appliedCoupons: [],
  codes: [],
  rejectedCodes: [],
};

const quote = (over: Record<string, unknown> = {}) => ({
  zone: { id: 'z1', nameEn: 'Inside Dhaka', nameBn: null, etaMinDays: 1, etaMaxDays: 2 },
  subtotalP: 300000,
  autoDiscountP: 0,
  couponDiscountP: 0,
  appliedCoupons: [],
  rejectedCodes: [],
  deliveryChargeP: 6000,
  deliveryDiscountP: 0,
  grandTotalP: 306000,
  freeDeliveryRemainingP: 12000,
  guestOtpRequired: false,
  problems: [],
  ...over,
});

let placeResult: () => unknown;
let quoteResult: () => unknown;

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  resetCart();
  resetSession();
  resetGeo();
  sessionStorage.clear();
  placeResult = () =>
    ok({ orderNo: '2610-00007', orderId: 'o1', grandTotalP: 306000, codDueP: 306000 });
  quoteResult = () => ok(quote());
  h.GET.mockImplementation(
    async (path: string, opts?: { params?: { query?: { districtId?: number } } }) => {
      if (path.endsWith('/divisions')) return ok([{ id: 6, nameEn: 'Dhaka', nameBn: 'ঢাকা' }]);
      if (path.endsWith('/districts'))
        return ok([{ id: 47, nameEn: 'Dhaka', nameBn: 'ঢাকা', divisionId: 6 }]);
      if (path.endsWith('/upazilas'))
        return ok([
          {
            id: 1003,
            nameEn: 'Gulshan',
            nameBn: 'গুলশান',
            districtId: opts?.params?.query?.districtId,
          },
        ]);
      return ok({});
    },
  );
  h.POST.mockImplementation(async (path: string) => {
    if (path.endsWith('/quote')) return quoteResult();
    if (path.endsWith('/place')) return placeResult();
    if (path.endsWith('/otp'))
      return ok({ sentTo: '018******44', expiresInSec: 300, resendInSec: 60 });
    return ok({});
  });
});

async function fillGuest() {
  fireEvent.change(screen.getByLabelText(d.name), { target: { value: 'Rahim' } });
  fireEvent.change(screen.getByLabelText(d.phone), { target: { value: '০১৮১১২২৩৩৪৪' } });
  await screen.findByRole('option', { name: 'Dhaka' });
  fireEvent.change(screen.getByLabelText(d.division), { target: { value: '6' } });
  await screen.findByRole('option', { name: 'Dhaka', selected: false });
  fireEvent.change(screen.getByLabelText(d.district), { target: { value: '47' } });
  await screen.findByRole('option', { name: 'Gulshan' });
  fireEvent.change(screen.getByLabelText(d.upazila), { target: { value: '1003' } });
  fireEvent.change(screen.getByLabelText(d.line), { target: { value: 'Road 1, Gulshan' } });
}

describe('address validation', () => {
  it('requires place and line, and contact only when asked', () => {
    expect(validateAddress(EMPTY_ADDRESS, d.errors, false)).toMatchObject({
      divisionId: d.errors.placeRequired,
      districtId: d.errors.placeRequired,
      upazilaId: d.errors.placeRequired,
      line: d.errors.lineRequired,
    });
    const withContact = validateAddress(EMPTY_ADDRESS, d.errors, true);
    expect(withContact.name).toBe(d.errors.nameRequired);
    expect(withContact.phone).toBe(d.errors.phoneInvalid);
    const good = { ...EMPTY_ADDRESS, divisionId: 1, districtId: 2, upazilaId: 3, line: 'House 4' };
    expect(validateAddress(good, d.errors, false)).toEqual({});
  });
});

describe('checkout errors', () => {
  it('maps codes, then status, then generic', () => {
    const e = (status: number, code: string | null) => ({
      ok: false as const,
      status,
      code,
      message: null,
    });
    expect(checkoutError(e(409, 'OUT_OF_STOCK'), d.errors)).toBe(d.errors.OUT_OF_STOCK);
    expect(checkoutError(e(422, 'NO_DELIVERY_ZONE'), d.errors)).toBe(d.errors.NO_DELIVERY_ZONE);
    expect(checkoutError(e(400, 'OTP_INVALID'), d.errors)).toBe(d.errors.OTP_INVALID);
    expect(checkoutError(e(429, null), d.errors)).toBe(d.errors.TOO_MANY_REQUESTS);
    expect(checkoutError(e(400, 'SOMETHING'), d.errors)).toBe(d.errors.validation);
    expect(checkoutError(e(429, 'TOO_MANY_ORDERS'), d.errors)).toBe(d.errors.TOO_MANY_ORDERS);
    expect(checkoutError({ ...e(429, 'GUEST_LIMIT'), reason: 'open_orders' }, d.errors)).toBe(
      d.errors.GUEST_LIMIT_open_orders,
    );
    expect(checkoutError({ ...e(429, 'GUEST_LIMIT'), reason: 'daily_cap' }, d.errors)).toBe(
      d.errors.GUEST_LIMIT_daily_cap,
    );
    expect(checkoutError({ ...e(429, 'TOO_MANY_ATTEMPTS'), retryAfterSec: 301 }, d.errors)).toBe(
      'Too many wrong codes. Try again in 6 min.',
    );
    expect(
      checkoutError(
        { ...e(429, 'TOO_MANY_ATTEMPTS'), retryAfterSec: 120 },
        bn.checkout.errors,
        'bn',
      ),
    ).toBe('অনেকবার ভুল কোড দিয়েছেন। ২ মিনিট পরে আবার চেষ্টা করুন।');
    expect(checkoutError(e(0, 'NETWORK'), d.errors)).toBe(d.errors.network);
    expect(checkoutError(e(500, null), d.errors)).toBe(d.errors.generic);
    expect(cartNoticeFor('CART_CHANGED')).toBe('changed');
    expect(cartNoticeFor('OUT_OF_STOCK')).toBe('stock');
    expect(cartNoticeFor('CART_EMPTY')).toBe('empty');
    expect(cartNoticeFor('OTP_INVALID')).toBeNull();
  });
});

describe('CheckoutForm (guest)', () => {
  it('quotes the delivery for the chosen place, then places once with an idempotency key', async () => {
    render(<CheckoutForm lang="en" initialCart={cart} me={null} addresses={[]} />);
    await fillGuest();
    expect(await screen.findByText('৳60')).toBeInTheDocument();
    expect(h.POST).toHaveBeenCalledWith('/v1/checkout/quote', {
      body: { districtId: 47, upazilaId: 1003, areaId: null },
    });
    expect(screen.getByText('Estimated delivery: 1-2 days')).toBeInTheDocument();
    expect(screen.getByText('Add ৳120 more for free delivery')).toBeInTheDocument();

    const place = screen.getByRole('button', { name: d.place });
    fireEvent.click(place);
    fireEvent.click(place);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/order/2610-00007'));
    const calls = h.POST.mock.calls.filter(([p]) => p === '/v1/checkout/place');
    expect(calls).toHaveLength(1);
    const body = calls[0]?.[1].body;
    expect(body.idempotencyKey).toMatch(/[0-9a-f-]{8,}/);
    expect(body.guest).toEqual({ name: 'Rahim', phone: '০১৮১১২২৩৩৪৪' });
    expect(body.address).toMatchObject({
      districtId: 47,
      upazilaId: 1003,
      line: 'Road 1, Gulshan',
    });
    expect(body.lang).toBe('en');
    expect(recallPlaced('2610-00007')?.codDueP).toBe(306000);
  });

  it('shows field errors and does not call place when details are missing', async () => {
    render(<CheckoutForm lang="en" initialCart={cart} me={null} addresses={[]} />);
    fireEvent.click(screen.getByRole('button', { name: d.place }));
    expect(await screen.findByText(d.errors.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(d.errors.phoneInvalid)).toBeInTheDocument();
    expect(h.POST.mock.calls.some(([p]) => p === '/v1/checkout/place')).toBe(false);
  });

  it('asks for an SMS code when the quote requires it', async () => {
    quoteResult = () => ok(quote({ guestOtpRequired: true }));
    render(<CheckoutForm lang="en" initialCart={cart} me={null} addresses={[]} />);
    await fillGuest();
    const send = await screen.findByRole('button', { name: d.sendCode });
    fireEvent.click(send);
    const code = await screen.findByLabelText(d.code);
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(h.POST).toHaveBeenCalledWith('/v1/checkout/otp', { body: { phone: '01811223344' } });
    expect(screen.getByRole('button', { name: /Resend code in/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: d.place }));
    expect(await screen.findAllByText(d.errors.codeRequired)).not.toHaveLength(0);

    fireEvent.change(code, { target: { value: '123456' } });
    placeResult = () => fail(400, 'OTP_INVALID');
    fireEvent.click(screen.getByRole('button', { name: d.place }));
    expect(await screen.findAllByText(d.errors.OTP_INVALID)).not.toHaveLength(0);
    expect(h.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: d.place })).toBeEnabled();
  });

  it('sends the customer back to the cart when the cart changed', async () => {
    placeResult = () => fail(409, 'CART_CHANGED');
    render(<CheckoutForm lang="en" initialCart={cart} me={null} addresses={[]} />);
    await fillGuest();
    await screen.findByText('৳60');
    fireEvent.click(screen.getByRole('button', { name: d.place }));
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/cart?notice=changed'));
  });

  it('explains the guest order limit and offers login', async () => {
    placeResult = () => ({
      error: { code: 'GUEST_LIMIT', reason: 'daily_cap', message: 'x' },
      response: { ok: false, status: 429 },
    });
    render(<CheckoutForm lang="en" initialCart={cart} me={null} addresses={[]} />);
    await fillGuest();
    await screen.findByText('৳60');
    fireEvent.click(screen.getByRole('button', { name: d.place }));
    expect(await screen.findByText(d.errors.GUEST_LIMIT_daily_cap)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: d.loginToOrder })).toHaveAttribute(
      'href',
      '/login?next=%2Fcheckout',
    );
  });

  it('blocks placing when the area is not deliverable', async () => {
    quoteResult = () => fail(422, 'NO_DELIVERY_ZONE');
    render(<CheckoutForm lang="en" initialCart={cart} me={null} addresses={[]} />);
    await fillGuest();
    expect(await screen.findAllByText(d.errors.NO_DELIVERY_ZONE)).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: d.place })).toBeDisabled();
  });
});

describe('CheckoutForm (logged in)', () => {
  const me = {
    id: 'u1',
    name: 'Karim Hossain',
    phone: '01755667788',
    phoneVerified: true,
    email: null,
    lang: 'en' as const,
    createdAt: '2026-01-01T00:00:00Z',
  };
  const saved = {
    id: 'a1',
    label: 'Home',
    name: 'Karim Hossain',
    phone: '01755667788',
    districtId: 47,
    upazilaId: 1003,
    areaId: null,
    line: 'Road 9',
    landmark: null,
    isDefault: true,
    placeText: 'Gulshan, Dhaka',
    placeTextBn: 'গুলশান, ঢাকা',
  };

  it('shows the Bangla place text of saved addresses under /bn', () => {
    render(<CheckoutForm lang="bn" initialCart={cart} me={me} addresses={[saved]} />);
    expect(screen.getByText(/গুলশান, ঢাকা/)).toBeInTheDocument();
  });

  it('preselects the default saved address, quotes it and places with addressId', async () => {
    render(<CheckoutForm lang="en" initialCart={cart} me={me} addresses={[saved]} />);
    expect(screen.queryByLabelText(d.name)).toBeNull();
    expect(await screen.findByText('৳60')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: d.place }));
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/order/2610-00007'));
    const body = h.POST.mock.calls.find(([p]) => p === '/v1/checkout/place')?.[1].body;
    expect(body.addressId).toBe('a1');
    expect(body.guest).toBeUndefined();
    expect(body.address).toBeUndefined();
  });
});

describe('SuccessView', () => {
  it('shows the remembered order for a guest', async () => {
    rememberPlaced({
      orderNo: '2610-00007',
      grandTotalP: 306000,
      codDueP: 306000,
      etaMinDays: 1,
      etaMaxDays: 2,
      zoneName: null,
    });
    render(<SuccessView lang="en" orderNo="2610-00007" server={null} loggedIn={false} />);
    expect(await screen.findByText('2610-00007')).toBeInTheDocument();
    expect(screen.getAllByText('৳3,060').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: en.checkout.success.track })).toHaveAttribute(
      'href',
      '/track?order=2610-00007',
    );
  });

  it('falls back to the tracking prompt for an unknown order', async () => {
    render(<SuccessView lang="en" orderNo="2610-00099" server={null} loggedIn={false} />);
    expect(await screen.findByText(en.checkout.success.unknownTitle)).toBeInTheDocument();
  });
});
