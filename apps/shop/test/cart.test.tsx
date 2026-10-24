import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { resetSession } from '~/features/account/session';
import { addToCart } from '~/features/browse/cart-actions';
import { CartCount } from '~/features/cart/CartCount';
import { CartView } from '~/features/cart/CartView';
import { resetCart, setCart } from '~/features/cart/store';
import type { Cart, CartLine } from '~/features/cart/types';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';

const d = en.cart;
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    variantId: 'v1',
    productId: 'p1',
    slug: 'shirt',
    titleEn: 'Blue Shirt',
    titleBn: 'নীল শার্ট',
    optionsTextEn: 'Size M',
    optionsTextBn: 'সাইজ M',
    image: null,
    qty: 2,
    unitPriceP: 150000,
    compareAtP: null,
    priceAtAddP: 150000,
    priceChanged: false,
    available: 5,
    maxQty: 5,
    problem: null,
    ...over,
  };
}
const cartOf = (items: CartLine[]): Cart => ({
  items,
  count: items.reduce((n, l) => n + l.qty, 0),
  subtotalP: items.filter((l) => !l.problem).reduce((n, l) => n + l.qty * l.unitPriceP, 0),
});

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  resetCart();
  resetSession();
  // biome-ignore lint/suspicious/noDocumentCookie: test fixture
  document.cookie = 'bdc_ch=; path=/; max-age=0';
});

describe('CartView', () => {
  it('shows lines, subtotal and an enabled checkout link', () => {
    render(<CartView lang="en" initial={cartOf([line()])} />);
    expect(screen.getByText('Blue Shirt')).toBeInTheDocument();
    expect(screen.getByText('Size M')).toBeInTheDocument();
    expect(screen.getAllByText('৳3,000').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Checkout (2)' })).toHaveAttribute('href', '/checkout');
  });

  it('is Bangla with Bangla digits under /bn', () => {
    render(<CartView lang="bn" initial={cartOf([line()])} />);
    expect(screen.getByText('নীল শার্ট')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: bn.cart.checkoutN.replace('{n}', '২') }),
    ).toHaveAttribute('href', '/bn/checkout');
  });

  it('blocks checkout while a line has a problem and offers to fix the quantity', async () => {
    h.PUT.mockResolvedValue(ok(cartOf([line({ qty: 3, available: 3, maxQty: 3 })])));
    render(
      <CartView
        lang="en"
        initial={cartOf([line({ qty: 5, available: 3, maxQty: 3, problem: 'qty_reduced' })])}
      />,
    );
    expect(screen.queryByRole('link', { name: /Checkout/ })).toBeNull();
    expect(screen.getByRole('button', { name: d.checkout })).toBeDisabled();
    expect(screen.getByText(d.blocked)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set to 3' }));
    await waitFor(() =>
      expect(h.PUT).toHaveBeenCalledWith('/v1/cart/items/{variantId}', {
        params: { path: { variantId: 'v1' } },
        body: { qty: 3 },
      }),
    );
    expect(await screen.findByRole('link', { name: 'Checkout (3)' })).toBeInTheDocument();
  });

  it('marks out-of-stock lines (no stepper) and price changes', () => {
    render(
      <CartView
        lang="en"
        initial={cartOf([
          line({ problem: 'out_of_stock', available: 0, maxQty: 0 }),
          line({ variantId: 'v2', priceChanged: true, priceAtAddP: 100000, unitPriceP: 150000 }),
        ])}
      />,
    );
    expect(screen.getByText(d.problems.out_of_stock)).toBeInTheDocument();
    expect(screen.getByText(/Price changed: was ৳1,000, now ৳1,500/)).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  it('respects maxQty on the stepper and updates through the API', async () => {
    h.PUT.mockResolvedValue(ok(cartOf([line({ qty: 5 })])));
    render(<CartView lang="en" initial={cartOf([line({ qty: 4, maxQty: 5 })])} />);
    const inc = screen.getByRole('button', { name: d.qtyInc });
    fireEvent.click(inc);
    await waitFor(() =>
      expect(h.PUT).toHaveBeenCalledWith(
        '/v1/cart/items/{variantId}',
        expect.objectContaining({ body: { qty: 5 } }),
      ),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: d.qtyInc })).toBeDisabled());
  });

  it('removes a line with DELETE and shows the empty state', async () => {
    h.DELETE.mockResolvedValue(ok(cartOf([])));
    render(<CartView lang="en" initial={cartOf([line()])} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(await screen.findByText(d.empty)).toBeInTheDocument();
    expect(h.DELETE).toHaveBeenCalledWith('/v1/cart/items/{variantId}', {
      params: { path: { variantId: 'v1' } },
    });
  });

  it('shows a notice sent back from checkout', () => {
    render(<CartView lang="en" initial={cartOf([line()])} notice="stock" />);
    expect(screen.getByRole('alert')).toHaveTextContent(d.notice.stock);
  });
});

describe('cart store', () => {
  it('addToCart adds to the current quantity, capped, and feeds the header badge', async () => {
    h.GET.mockResolvedValue(ok(cartOf([line({ qty: 2 })])));
    h.PUT.mockResolvedValue(ok(cartOf([line({ qty: 4 })])));
    render(<CartCount lang="en" />);
    const r = await addToCart('v1', 5, 4);
    expect(r).toEqual({ ok: true, count: 4 });
    expect(h.PUT).toHaveBeenCalledWith(
      '/v1/cart/items/{variantId}',
      expect.objectContaining({ body: { qty: 4 } }),
    );
    expect(await screen.findByText('4')).toBeInTheDocument();
  });

  it('addToCart fails cleanly when the cart cannot be read', async () => {
    h.GET.mockResolvedValue({ error: {}, response: { ok: false, status: 500 } });
    expect(await addToCart('v1', 1)).toEqual({ ok: false, status: 0 });
    expect(h.PUT).not.toHaveBeenCalled();
  });

  it('header badge stays hidden for an empty cart and shows Bangla digits', () => {
    const { container } = render(<CartCount lang="bn" />);
    expect(container).toBeEmptyDOMElement();
    setCart(cartOf([line({ qty: 3 })]));
    return screen.findByText('৩');
  });
});
