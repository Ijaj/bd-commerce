import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '~/features/categories/http';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  pause: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
  lookup: vi.fn(),
  generate: vi.fn(),
  codes: vi.fn(),
  assign: vi.fn(),
  exportCodes: vi.fn(),
  report: vi.fn(),
}));
const perm = vi.hoisted(() => ({ can: true }));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('~/features/coupons/api', () => ({ couponsApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: () => perm.can }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => nav.navigate,
}));

import { CouponEditorPage } from '~/features/coupons/CouponEditorPage';
import { CouponsPage } from '~/features/coupons/CouponsPage';

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

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Eid offer',
  kind: 'code',
  code: 'EID',
  isBulk: false,
  type: 'percent',
  value: 1000,
  status: 'active',
  phase: 'live',
  visibility: 'public',
  isCollectable: false,
  startsAt: null,
  endsAt: null,
  usesCount: 4,
  discountGivenP: 20000,
  maxUsesTotal: 100,
  budgetCapP: null,
  priority: 0,
  createdAt: '2026-10-25T00:00:00.000Z',
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  ...row(),
  termsEn: null,
  termsBn: null,
  maxDiscountP: null,
  config: {},
  minOrderP: null,
  minQty: null,
  segment: 'all',
  segmentParam: null,
  paymentMethods: [],
  platform: 'both',
  maxPerCustomer: null,
  maxPerPhone: null,
  maxPerDevice: null,
  stacksWithSalePrice: false,
  stacksWithOtherCoupons: false,
  stacksWithPoints: false,
  source: 'manual',
  updatedAt: '2026-10-25T00:00:00.000Z',
  targets: [],
  zones: [],
  tiers: [],
  customers: [],
  codeStats: { total: 0, used: 0, assigned: 0 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  perm.can = true;
});

describe('CouponsPage', () => {
  it('lists coupons with discount, phase and uses', async () => {
    mocks.list.mockResolvedValue({ items: [row()], total: 1, page: 1, limit: 25 });
    wrap(<CouponsPage />);
    expect(await screen.findByText('Eid offer')).toBeInTheDocument();
    expect(screen.getByText('10% off')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('4 / 100')).toBeInTheDocument();
    expect(screen.getByText('New coupon')).toBeInTheDocument();
  });

  it('hides the create button without coupons.manage', async () => {
    perm.can = false;
    mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25 });
    wrap(<CouponsPage />);
    expect(await screen.findByText('No coupons match.')).toBeInTheDocument();
    expect(screen.queryByText('New coupon')).not.toBeInTheDocument();
  });
});

describe('CouponEditorPage', () => {
  function fillBasics() {
    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Welcome' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Code/ }), {
      target: { value: 'welcome10' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Percent off/ }), {
      target: { value: '10' },
    });
  }

  it('creates a percent coupon and opens it', async () => {
    mocks.create.mockResolvedValue(detail({ id: 'new1' }));
    wrap(<CouponEditorPage />);
    fillBasics();
    fireEvent.click(screen.getByText('Create coupon'));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      name: 'Welcome',
      kind: 'code',
      code: 'WELCOME10',
      type: 'percent',
      value: 1000,
    });
    await waitFor(() =>
      expect(nav.navigate).toHaveBeenCalledWith({
        to: '/promotions/coupons/$id',
        params: { id: 'new1' },
      }),
    );
  });

  it('does not call the API when the form is obviously wrong', async () => {
    wrap(<CouponEditorPage />);
    fireEvent.click(screen.getByText('Create coupon'));
    expect(await screen.findAllByText('Give the coupon a name.')).not.toHaveLength(0);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('shows the API issues[] under the matching section', async () => {
    mocks.create.mockRejectedValue(
      new HttpError('Tiers must have strictly ascending minimum spend.', 422, {
        code: 'COUPON_CONFIG_INVALID',
        issues: [
          'Tiers must have strictly ascending minimum spend.',
          'A collectable coupon must be public.',
        ],
      }),
    );
    wrap(<CouponEditorPage />);
    fillBasics();
    fireEvent.click(screen.getByText('Create coupon'));
    // Once in the summary alert and once in its own section.
    expect(
      await screen.findAllByText('Tiers must have strictly ascending minimum spend.'),
    ).toHaveLength(2);
    expect(screen.getAllByText('A collectable coupon must be public.')).toHaveLength(2);
  });

  it('freezes type and code once the coupon was redeemed', async () => {
    mocks.detail.mockResolvedValue(detail({ usesCount: 3 }));
    wrap(<CouponEditorPage id="c1" />);
    const code = await screen.findByRole('textbox', { name: /^Code/ });
    expect(code).toBeDisabled();
    expect(screen.getAllByText(/already used in orders/).length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeEnabled();
  });

  it('offers pause for an active coupon and activate for a draft', async () => {
    mocks.detail.mockResolvedValue(detail());
    const first = wrap(<CouponEditorPage id="c1" />);
    expect(await screen.findByText('Pause')).toBeInTheDocument();
    first.unmount();
    mocks.detail.mockResolvedValue(detail({ status: 'draft', phase: 'draft', usesCount: 0 }));
    wrap(<CouponEditorPage id="c1" />);
    expect(await screen.findByText('Activate')).toBeInTheDocument();
  });

  it('is read-only without coupons.manage', async () => {
    perm.can = false;
    mocks.detail.mockResolvedValue(detail());
    wrap(<CouponEditorPage id="c1" />);
    expect(await screen.findByRole('textbox', { name: /^Name/ })).toBeDisabled();
    expect(screen.queryByText('Save changes')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
