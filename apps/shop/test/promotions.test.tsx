import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { ProductCard } from '~/components/ProductCard';
import { resetSession } from '~/features/account/session';
import { addToCart } from '~/features/browse/cart-actions';
import { CartView } from '~/features/cart/CartView';
import { resetCart } from '~/features/cart/store';
import { type Cart, type CartLine, EMPTY_CART } from '~/features/cart/types';
import { cartNoticeFor } from '~/features/checkout/errors';
import { Summary } from '~/features/checkout/Summary';
import { Countdown } from '~/features/promotions/Countdown';
import { CouponCard } from '~/features/promotions/CouponCard';
import { DiscountList } from '~/features/promotions/DiscountList';
import { FlashBox } from '~/features/promotions/FlashBox';
import {
  couponFacts,
  couponValueText,
  formatRemaining,
  lowFlash,
  percentText,
  rejectText,
} from '~/features/promotions/logic';
import type { PublicCoupon, WalletCoupon } from '~/features/promotions/types';
import { WalletList } from '~/features/promotions/WalletList';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const fail = (status: number, body: Record<string, unknown>) => ({
  error: { message: 'x', ...body },
  response: { ok: false, status },
});

const p = en.promos;

function line(over: Partial<CartLine> = {}): CartLine {
  return {
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
    ...over,
  };
}
const cartOf = (items: CartLine[], over: Partial<Cart> = {}): Cart => ({
  ...EMPTY_CART,
  items,
  count: items.reduce((n, l) => n + l.qty, 0),
  subtotalP: items.reduce((n, l) => n + l.qty * l.unitPriceP, 0),
  ...over,
});

const coupon = (over: Partial<PublicCoupon> = {}): PublicCoupon => ({
  id: 'c1',
  name: 'Eid offer',
  kind: 'code',
  code: 'EID10',
  type: 'percent',
  value: 1000,
  maxDiscountP: 50000,
  minOrderP: 200000,
  startsAt: null,
  endsAt: '2026-12-31T10:00:00.000Z',
  termsEn: 'One use per customer',
  termsBn: null,
  isCollectable: true,
  ...over,
});

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  resetCart();
  resetSession();
  // biome-ignore lint/suspicious/noDocumentCookie: test fixture
  document.cookie = 'bdc_in=; path=/; max-age=0';
});
afterEach(() => vi.useRealTimers());

describe('promotion logic', () => {
  it('formats remaining time with days and Bangla digits, null at zero', () => {
    expect(formatRemaining(2 * 86400_000 + 3 * 3600_000 + 4 * 60_000 + 5000, 'en', 'd')).toBe(
      '2d 03:04:05',
    );
    expect(formatRemaining(61_000, 'bn', 'দিন')).toBe('০০:০১:০১');
    expect(formatRemaining(86400_000, 'bn', 'দিন')).toBe('১ দিন ০০:০০:০০');
    expect(formatRemaining(0, 'en', 'd')).toBeNull();
    expect(formatRemaining(-5, 'en', 'd')).toBeNull();
  });

  it('shows basis points as percent', () => {
    expect(percentText(1000, 'en')).toBe('10');
    expect(percentText(1250, 'en')).toBe('12.5');
    expect(percentText(1225, 'bn')).toBe('১২.২৫');
  });

  it('summarises every coupon type', () => {
    const t = p.coupon;
    expect(couponValueText(coupon(), 'en', t)).toBe('10% off, up to ৳500');
    expect(couponValueText(coupon({ maxDiscountP: null }), 'en', t)).toBe('10% off');
    expect(couponValueText(coupon({ type: 'fixed', value: 30000 }), 'en', t)).toBe('৳300 off');
    expect(couponValueText(coupon({ type: 'free_delivery' }), 'en', t)).toBe('Free delivery');
    expect(couponValueText(coupon({ type: 'bxgy' }), 'bn', bn.promos.coupon)).toBe(
      bn.promos.coupon.bxgy,
    );
  });

  it('lists min order, a future start and the end date', () => {
    const facts = couponFacts(
      coupon({ startsAt: '2026-11-01T00:00:00.000Z' }),
      'en',
      p.coupon,
      Date.parse('2026-10-25T00:00:00.000Z'),
    );
    expect(facts[0]).toBe('Min. order ৳2,000');
    expect(facts[1]).toMatch(/^Starts /);
    expect(facts[2]).toMatch(/^Valid until /);
  });

  it('maps reject reasons and falls back for unknown ones', () => {
    expect(rejectText('MIN_ORDER', p.cart.reasons)).toBe(p.cart.reasons.MIN_ORDER);
    expect(rejectText('SOMETHING_NEW', p.cart.reasons)).toBe(p.cart.reasons.unknown);
    expect(rejectText(undefined, p.cart.reasons)).toBe(p.cart.reasons.unknown);
  });

  it('only calls a flash price scarce when a few units are left', () => {
    expect(lowFlash(3)).toBe(true);
    expect(lowFlash(0)).toBe(false);
    expect(lowFlash(500)).toBe(false);
  });

  it('has the same reject reasons in both languages', () => {
    expect(Object.keys(bn.promos.cart.reasons).sort()).toEqual(
      Object.keys(en.promos.cart.reasons).sort(),
    );
  });

  it('sends promotion errors back to the cart', () => {
    expect(cartNoticeFor('FLASH_LIMIT')).toBe('flash');
    expect(cartNoticeFor('FLASH_SOLD_OUT')).toBe('flash_sold');
    expect(cartNoticeFor('COUPON_INVALID')).toBe('coupon');
    expect(cartNoticeFor('COUPON_LIMIT')).toBe('coupon_limit');
    expect(cartNoticeFor('OTP_INVALID')).toBeNull();
  });
});

describe('Countdown', () => {
  it('ticks every second and disappears at zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T10:00:00.000Z'));
    const onEnd = vi.fn();
    render(<Countdown endsAt="2026-10-25T10:00:03.000Z" lang="en" onEnd={onEnd} />);
    expect(screen.getByText('Ends in 00:00:03')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Ends in 00:00:02')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText(/Ends in/)).toBeNull();
    expect(onEnd).toHaveBeenCalled();
  });

  it('renders nothing for a sale that already ended and says "Starts in" for upcoming ones', () => {
    const now = Date.now();
    const { container } = render(
      <Countdown endsAt={new Date(now - 5000).toISOString()} lang="en" />,
    );
    expect(container).toBeEmptyDOMElement();
    render(<Countdown endsAt={new Date(now + 90_000).toISOString()} lang="bn" mode="starts" />);
    expect(screen.getByText(/শুরু হবে/)).toBeInTheDocument();
  });
});

describe('FlashBox', () => {
  it('shows scarcity and the personal limit', () => {
    const endsAt = new Date(Date.now() + 3600_000).toISOString();
    render(<FlashBox lang="en" flash={{ endsAt, remaining: 4, perCustomerLimit: 2 }} />);
    expect(screen.getByText('Only 4 left at flash price')).toBeInTheDocument();
    expect(screen.getByText('Limit 2 per customer')).toBeInTheDocument();
  });
  it('hides scarcity when stock is plentiful', () => {
    const endsAt = new Date(Date.now() + 3600_000).toISOString();
    render(<FlashBox lang="en" flash={{ endsAt, remaining: 400, perCustomerLimit: null }} />);
    expect(screen.queryByText(/left at flash price/)).toBeNull();
  });
});

describe('addToCart flash limit', () => {
  it('reports how many units are left at the flash price', async () => {
    h.GET.mockResolvedValue(ok(cartOf([line({ qty: 1 })])));
    h.PUT.mockResolvedValue(fail(409, { code: 'FLASH_LIMIT', remaining: 2 }));
    expect(await addToCart('v1', 5)).toEqual({ ok: false, status: 409, flashRemaining: 2 });
  });
});

describe('CouponCard', () => {
  it('copies a code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <ul>
        <CouponCard coupon={coupon({ isCollectable: false })} lang="en" nextPath="/offers" />
      </ul>,
    );
    expect(screen.getByText('10% off, up to ৳500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /EID10/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('EID10'));
    expect(await screen.findByText(p.coupon.copied)).toBeInTheDocument();
  });

  it('sends a logged-out visitor to login instead of collecting', async () => {
    render(
      <ul>
        <CouponCard coupon={coupon()} lang="bn" nextPath="/offers" />
      </ul>,
    );
    const link = await screen.findByRole('link', { name: bn.promos.coupon.loginToCollect });
    expect(link).toHaveAttribute('href', `/bn/login?next=${encodeURIComponent('/bn/offers')}`);
  });

  it('collects for a signed-in customer and treats 409 as collected', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: test fixture
    document.cookie = 'bdc_in=1; path=/';
    h.GET.mockResolvedValue(ok({ id: 'u1', name: 'Karim', phone: '017', email: null }));
    h.POST.mockResolvedValue(fail(409, { code: 'ALREADY_COLLECTED' }));
    render(
      <ul>
        <CouponCard coupon={coupon()} lang="en" nextPath="/offers" />
      </ul>,
    );
    fireEvent.click(await screen.findByRole('button', { name: p.coupon.collect }));
    expect(await screen.findByText(p.coupon.collected)).toBeInTheDocument();
    expect(h.POST).toHaveBeenCalledWith('/v1/customer/coupons/{couponId}/collect', {
      params: { path: { couponId: 'c1' } },
    });
  });

  it('says automatic offers apply at checkout', () => {
    render(
      <ul>
        <CouponCard coupon={coupon({ kind: 'auto', code: null })} lang="en" nextPath="/offers" />
      </ul>,
    );
    expect(screen.getByText(p.coupon.autoApplied)).toBeInTheDocument();
  });
});

describe('WalletList', () => {
  const item = (over: Partial<WalletCoupon> = {}): WalletCoupon => ({
    couponId: 'w1',
    name: 'Welcome',
    kind: 'code',
    code: 'WELCOME',
    type: 'fixed',
    value: 10000,
    maxDiscountP: null,
    minOrderP: null,
    startsAt: null,
    endsAt: null,
    termsEn: null,
    termsBn: null,
    source: 'collected',
    collected: true,
    state: 'usable',
    ...over,
  });

  it('shows state badges and removes a collected coupon', async () => {
    h.DELETE.mockResolvedValue({ response: { ok: true, status: 204 } });
    render(
      <WalletList
        lang="en"
        initial={[
          item(),
          item({ couponId: 'w2', name: 'Old', code: 'OLD', state: 'expired', collected: false }),
        ]}
      />,
    );
    expect(screen.getByText('Usable')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Remove/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(screen.queryByText('Welcome')).toBeNull());
    expect(h.DELETE).toHaveBeenCalledWith('/v1/customer/coupons/{couponId}', {
      params: { path: { couponId: 'w1' } },
    });
  });

  it('has an empty state with a link to the offers page', () => {
    render(<WalletList lang="bn" initial={[]} />);
    expect(screen.getByRole('link', { name: bn.promos.wallet.browse })).toHaveAttribute(
      'href',
      '/bn/offers',
    );
  });
});

describe('DiscountList', () => {
  it('lists each offer with its saving and delivery note', () => {
    render(
      <DiscountList
        lang="en"
        rows={[
          { name: 'Eid offer', code: 'EID10', amountP: 15000, freeDelivery: false },
          { name: 'Free ship', code: null, amountP: 6000, freeDelivery: true },
        ]}
      />,
    );
    expect(screen.getByText('−৳150')).toBeInTheDocument();
    expect(screen.getByText(/Code EID10/)).toBeInTheDocument();
    expect(screen.getByText(/free delivery/)).toBeInTheDocument();
  });
  it('renders nothing without rows', () => {
    const { container } = render(<DiscountList lang="en" rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('cart promotions', () => {
  it('shows flash badge, line discount and the discount row', () => {
    h.GET.mockResolvedValue(ok({ items: [] }));
    const endsAt = new Date(Date.now() + 3600_000).toISOString();
    render(
      <CartView
        lang="en"
        initial={cartOf([line({ flashEndsAt: endsAt, discountP: 20000 })], { discountP: 20000 })}
      />,
    );
    expect(screen.getByText(p.flash.short)).toBeInTheDocument();
    expect(screen.getByText('Offer discount −৳200')).toBeInTheDocument();
    expect(screen.getByText('−৳200')).toBeInTheDocument();
  });

  it('shows FLASH_LIMIT inline on the refused line', async () => {
    h.GET.mockResolvedValue(ok({ items: [] }));
    h.PUT.mockResolvedValue(fail(409, { code: 'FLASH_LIMIT', remaining: 3 }));
    render(<CartView lang="en" initial={cartOf([line({ qty: 2 })])} />);
    fireEvent.click(screen.getByRole('button', { name: en.cart.qtyInc }));
    expect(
      await screen.findByText('Only 3 left at flash price. Quantity changed.'),
    ).toBeInTheDocument();
  });

  it('applies a typed code and shows the applied offer', async () => {
    h.GET.mockResolvedValue(ok({ items: [] }));
    const applied = cartOf([line()], {
      discountP: 30000,
      codes: ['EID10'],
      appliedCoupons: [
        {
          couponId: 'c1',
          name: 'Eid offer',
          kind: 'code',
          type: 'percent',
          code: 'EID10',
          amountP: 30000,
          freeDelivery: false,
        },
      ],
    });
    h.POST.mockResolvedValue(ok(applied));
    render(<CartView lang="en" initial={cartOf([line()])} />);
    fireEvent.change(screen.getByLabelText(p.cart.label), { target: { value: 'eid10' } });
    fireEvent.click(screen.getByRole('button', { name: p.cart.apply }));
    expect(await screen.findByText('Eid offer')).toBeInTheDocument();
    expect(h.POST).toHaveBeenCalledWith('/v1/cart/coupon', { body: { code: 'eid10' } });
    expect(screen.getByRole('button', { name: 'Remove coupon EID10' })).toBeInTheDocument();
  });

  it('explains why a code was refused, in the shopper language', async () => {
    h.GET.mockResolvedValue(ok({ items: [] }));
    h.POST.mockResolvedValue(fail(422, { code: 'COUPON_INVALID', reason: 'MIN_ORDER' }));
    render(<CartView lang="bn" initial={cartOf([line()])} />);
    fireEvent.change(screen.getByLabelText(bn.promos.cart.label), { target: { value: 'BIG' } });
    fireEvent.click(screen.getByRole('button', { name: bn.promos.cart.apply }));
    expect(await screen.findByRole('alert')).toHaveTextContent(bn.promos.cart.reasons.MIN_ORDER);
  });

  it('applies a suggestion in one tap', async () => {
    h.GET.mockResolvedValue(
      ok({
        items: [{ couponId: 'c2', name: 'Save', code: 'SAVE5', savingP: 5000, source: 'wallet' }],
      }),
    );
    h.POST.mockResolvedValue(ok(cartOf([line()], { codes: ['SAVE5'] })));
    render(<CartView lang="en" initial={cartOf([line()])} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply SAVE5, save ৳50' }));
    await waitFor(() =>
      expect(h.POST).toHaveBeenCalledWith('/v1/cart/coupon', { body: { code: 'SAVE5' } }),
    );
  });

  it('keeps a dropped code visible with its reason', () => {
    h.GET.mockResolvedValue(ok({ items: [] }));
    render(
      <CartView
        lang="en"
        initial={cartOf([line()], { rejectedCodes: [{ code: 'OLD', reason: 'EXPIRED' }] })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      `Coupon OLD was removed: ${p.cart.reasons.EXPIRED}`,
    );
  });
});

describe('flash on cards and checkout', () => {
  it('product card shows the flash tag with a countdown', () => {
    render(
      <ProductCard
        lang="en"
        product={{
          id: '1',
          slug: 'x',
          titleEn: 'Kettle',
          titleBn: null,
          image: null,
          priceP: 90000,
          compareAtP: 120000,
          discountPct: 25,
          flashEndsAt: new Date(Date.now() + 7200_000).toISOString(),
          ratingAvg: 0,
          ratingCount: 0,
          soldCount: 0,
          badges: { isNew: false, isPreorder: false, isUpcoming: false, outOfStock: false },
        }}
      />,
    );
    expect(screen.getByText(p.flash.short)).toBeInTheDocument();
    expect(screen.getByText(/Ends in 0[12]:/)).toBeInTheDocument();
  });

  it('checkout summary lists offer, coupon and delivery discounts', () => {
    render(
      <Summary
        lang="en"
        cart={cartOf([line()])}
        quoting={false}
        quote={{
          zone: { id: 'z', nameEn: 'Dhaka', nameBn: null, etaMinDays: 1, etaMaxDays: 2 },
          subtotalP: 300000,
          autoDiscountP: 10000,
          couponDiscountP: 20000,
          appliedCoupons: [
            {
              couponId: 'c',
              name: 'Eid',
              kind: 'code',
              type: 'percent',
              code: 'EID10',
              amountP: 20000,
              freeDelivery: false,
            },
          ],
          rejectedCodes: [{ code: 'OLD', reason: 'EXPIRED' }],
          deliveryChargeP: 6000,
          deliveryDiscountP: 6000,
          grandTotalP: 270000,
          freeDeliveryRemainingP: null,
          guestOtpRequired: false,
          problems: [],
        }}
      >
        <span />
      </Summary>,
    );
    expect(screen.getByText('Offer discount')).toBeInTheDocument();
    expect(screen.getByText('Coupon discount (EID10)')).toBeInTheDocument();
    expect(screen.getByText('−৳100')).toBeInTheDocument();
    expect(screen.getByText('−৳200')).toBeInTheDocument();
    expect(screen.getByText('You save ৳360')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Coupon OLD was removed');
  });
});
