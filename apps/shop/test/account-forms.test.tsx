import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn(),
  PATCH: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('~/lib/api-browser', () => ({
  browserApi: { GET: h.GET, POST: h.POST, PUT: h.PUT, DELETE: h.DELETE, PATCH: h.PATCH },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, refresh: h.refresh }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { LoginForm } from '~/features/account/LoginForm';
import { SignupForm } from '~/features/account/SignupForm';
import { resetSession } from '~/features/account/session';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import { resetWishlist } from '~/features/account/wishlist-store';
import { en } from '~/i18n/en';

const a = en.account;
const me = {
  id: 'u1',
  name: 'Rahim Uddin',
  phone: '01712345678',
  phoneVerified: true,
  email: null,
  lang: 'en',
  createdAt: '2026-01-01T00:00:00Z',
};
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const fail = (status: number, code?: string) => ({
  error: { code, message: 'x' },
  response: { ok: false, status },
});

function setHint(on: boolean) {
  // biome-ignore lint/suspicious/noDocumentCookie: test fixture for the hint cookie
  document.cookie = on ? 'bdc_in=1; path=/' : 'bdc_in=; path=/; max-age=0';
}

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  resetSession();
  resetWishlist();
  setHint(false);
});

describe('LoginForm', () => {
  it('shows field errors without calling the API', () => {
    render(<LoginForm lang="en" next="/account" />);
    fireEvent.click(screen.getByRole('button', { name: a.loginButton }));
    expect(screen.getByText(a.errors.loginRequired)).toBeInTheDocument();
    expect(screen.getByText(a.errors.passwordRequired)).toBeInTheDocument();
    expect(h.POST).not.toHaveBeenCalled();
  });

  it('logs in with a normalised phone and goes to next', async () => {
    h.POST.mockResolvedValue(ok({ customer: me }));
    render(<LoginForm lang="en" next="/p/shirt" />);
    fireEvent.change(screen.getByLabelText(a.loginId), { target: { value: '+8801712345678' } });
    fireEvent.change(screen.getByLabelText(a.password), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: a.loginButton }));
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/p/shirt'));
    expect(h.POST).toHaveBeenCalledWith('/v1/customer/auth/login', {
      body: { login: '01712345678', password: 'secret123' },
    });
    expect(document.cookie).toContain('bdc_in=1');
  });

  it('maps API error codes to friendly text', async () => {
    h.POST.mockResolvedValue(fail(401, 'INVALID_CREDENTIALS'));
    render(<LoginForm lang="en" next="/account" />);
    fireEvent.change(screen.getByLabelText(a.loginId), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(a.password), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: a.loginButton }));
    expect(await screen.findByRole('alert')).toHaveTextContent(a.errors.INVALID_CREDENTIALS);
    expect(h.replace).not.toHaveBeenCalled();
  });
});

describe('SignupForm', () => {
  it('sends the OTP, then creates the account with the code', async () => {
    h.POST.mockImplementation(async (path: string) =>
      path.endsWith('/otp')
        ? ok({ sentTo: '017******78', expiresInSec: 300, resendInSec: 60 })
        : ok({ customer: me }),
    );
    render(<SignupForm lang="en" next="/account" />);
    fireEvent.change(screen.getByLabelText(a.name), { target: { value: 'Rahim Uddin' } });
    fireEvent.change(screen.getByLabelText(a.phone), { target: { value: '০১৭১২৩৪৫৬৭৮' } });
    fireEvent.change(screen.getByLabelText(a.password), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: a.sendCode }));

    const code = await screen.findByLabelText(a.code);
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(h.POST).toHaveBeenCalledWith('/v1/customer/auth/otp', {
      body: { phone: '01712345678', purpose: 'signup' },
    });
    expect(screen.getByRole('button', { name: /Resend code in/ })).toBeDisabled();

    fireEvent.change(code, { target: { value: '১২৩৪৫৬' } });
    expect(code).toHaveValue('123456');
    fireEvent.click(screen.getByRole('button', { name: a.createButton }));
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/account'));
    expect(h.POST).toHaveBeenLastCalledWith('/v1/customer/auth/signup', {
      body: {
        name: 'Rahim Uddin',
        phone: '01712345678',
        email: undefined,
        password: 'secret123',
        code: '123456',
      },
    });
  });

  it('validates the details before asking for a code', () => {
    render(<SignupForm lang="en" next="/account" />);
    fireEvent.change(screen.getByLabelText(a.phone), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(a.password), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: a.sendCode }));
    expect(screen.getByText(a.errors.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(a.errors.phoneInvalid)).toBeInTheDocument();
    expect(screen.getByText(a.errors.passwordShort)).toBeInTheDocument();
    expect(h.POST).not.toHaveBeenCalled();
  });

  it('shows a taken phone as a friendly error and stays on step one', async () => {
    h.POST.mockResolvedValue(fail(409, 'PHONE_TAKEN'));
    render(<SignupForm lang="en" next="/account" />);
    fireEvent.change(screen.getByLabelText(a.name), { target: { value: 'R' } });
    fireEvent.change(screen.getByLabelText(a.phone), { target: { value: '01712345678' } });
    fireEvent.change(screen.getByLabelText(a.password), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: a.sendCode }));
    expect(await screen.findByRole('alert')).toHaveTextContent(a.errors.PHONE_TAKEN);
    expect(screen.queryByLabelText(a.code)).not.toBeInTheDocument();
  });
});

describe('WishlistHeart', () => {
  it('sends logged-out visitors to login with a next param and makes no API call', async () => {
    window.history.pushState({}, '', '/p/blue-panjabi?x=1');
    render(<WishlistHeart productId="p1" lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: en.shell.wishlist }));
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith('/login?next=%2Fp%2Fblue-panjabi%3Fx%3D1'),
    );
    expect(h.GET).not.toHaveBeenCalled();
  });

  it('toggles optimistically for a logged-in customer', async () => {
    setHint(true);
    h.GET.mockImplementation(async (path: string) =>
      path === '/v1/customer/me' ? ok(me) : ok({ productIds: ['p2'] }),
    );
    h.PUT.mockResolvedValue(ok({ ok: true }));
    h.DELETE.mockResolvedValue(ok({ ok: true }));
    render(
      <>
        <WishlistHeart productId="p1" lang="en" />
        <WishlistHeart productId="p2" lang="bn" />
      </>,
    );
    const [first, second] = screen.getAllByRole('button');
    await waitFor(() => expect(second).toHaveAttribute('aria-pressed', 'true'));
    expect(first).toHaveAttribute('aria-pressed', 'false');
    // ids are fetched once and shared by both hearts
    expect(h.GET.mock.calls.filter((c) => c[0] === '/v1/customer/wishlist/ids')).toHaveLength(1);

    fireEvent.click(first as HTMLElement);
    await waitFor(() => expect(first).toHaveAttribute('aria-pressed', 'true'));
    expect(h.PUT).toHaveBeenCalledWith('/v1/customer/wishlist/{productId}', {
      params: { path: { productId: 'p1' } },
    });
  });

  it('rolls back when the server refuses', async () => {
    setHint(true);
    h.GET.mockImplementation(async (path: string) =>
      path === '/v1/customer/me' ? ok(me) : ok({ productIds: [] }),
    );
    h.PUT.mockResolvedValue(fail(500));
    render(<WishlistHeart productId="p1" lang="en" />);
    const btn = screen.getByRole('button');
    await waitFor(() => expect(h.GET).toHaveBeenCalledTimes(2));
    fireEvent.click(btn);
    await waitFor(() => expect(h.PUT).toHaveBeenCalled());
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'false'));
  });
});

describe('session hint', () => {
  it('does not call /v1/customer/me for anonymous visitors', async () => {
    render(<WishlistHeart productId="p1" lang="en" />);
    await Promise.resolve();
    expect(h.GET).not.toHaveBeenCalled();
  });
});
