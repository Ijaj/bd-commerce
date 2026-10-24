import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));

vi.mock('~/lib/api-browser', () => ({
  browserApi: { GET: h.GET, POST: h.POST, PUT: h.PUT, PATCH: h.PATCH, DELETE: h.DELETE },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetSession } from '~/features/account/session';
import { resetGeo } from '~/features/checkout/geo';
import { AddressesManager } from '~/features/orders/AddressesManager';
import { OrderDetailView } from '~/features/orders/OrderDetailView';
import { OrderList } from '~/features/orders/OrderList';
import { Timeline } from '~/features/orders/Timeline';
import { TrackForm } from '~/features/orders/TrackForm';
import type { OrderDetail, OrderList as OrderListData } from '~/features/orders/types';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';

const d = en.orders;
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });

const history = [
  { status: 'processing' as const, at: '2026-10-24T12:00:00.000Z' },
  { status: 'shipped' as const, at: '2026-10-25T09:30:00.000Z' },
];

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  resetSession();
  resetGeo();
});
afterEach(() => vi.unstubAllGlobals());

describe('Timeline', () => {
  it('lists steps in order and marks the last one as current', () => {
    render(<Timeline lang="en" steps={history} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(d.status.processing);
    expect(items[1]).toHaveTextContent(d.status.shipped);
    expect(items[1]).toHaveTextContent(`(${d.status.shipped})`);
    expect(screen.getAllByRole('time')[0]).toHaveTextContent('24 Oct 2026');
  });

  it('uses Bangla labels', () => {
    render(<Timeline lang="bn" steps={history} />);
    expect(screen.getAllByText(bn.orders.status.shipped).length).toBeGreaterThan(0);
  });
});

describe('OrderList', () => {
  const data: OrderListData = {
    items: [
      {
        orderNo: '2610-00003',
        placedAt: '2026-10-24T12:19:00.000Z',
        status: 'processing',
        grandTotalP: 131000,
        itemCount: 1,
        firstImage: null,
      },
    ],
    total: 25,
    page: 2,
    limit: 10,
  };

  it('links each order and paginates', () => {
    render(<OrderList lang="en" data={data} basePath="/account/orders" />);
    expect(screen.getByRole('link', { name: /2610-00003/ })).toHaveAttribute(
      'href',
      '/account/orders/2610-00003',
    );
    expect(screen.getByText('৳1,310')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: d.prev })).toHaveAttribute(
      'href',
      '/account/orders?page=1',
    );
    expect(screen.getByRole('link', { name: d.next })).toHaveAttribute(
      'href',
      '/account/orders?page=3',
    );
  });

  it('shows the empty state', () => {
    render(
      <OrderList
        lang="en"
        data={{ ...data, items: [], total: 0, page: 1 }}
        basePath="/account/orders"
      />,
    );
    expect(screen.getByText(d.listEmpty)).toBeInTheDocument();
  });
});

describe('OrderDetailView', () => {
  const o: OrderDetail = {
    orderNo: '2610-00003',
    placedAt: '2026-10-24T12:19:00.000Z',
    status: 'processing',
    paymentStatus: 'unpaid',
    paymentMethod: 'cod',
    lang: 'en',
    isPreorder: false,
    customerNote: 'Call before coming',
    items: [
      {
        productId: 'p',
        variantId: 'v',
        slug: 'iron',
        title: 'Walton Dry Iron',
        sku: 'S',
        optionsText: null,
        image: null,
        qty: 1,
        qtyCancelled: 0,
        unitPriceP: 119000,
        lineTotalP: 119000,
      },
    ],
    money: {
      subtotalP: 119000,
      autoDiscountP: 0,
      couponDiscountP: 0,
      deliveryChargeP: 12000,
      deliveryDiscountP: 0,
      grandTotalP: 131000,
      paidP: 0,
      refundedP: 0,
      codDueP: 131000,
    },
    shipTo: {
      name: 'Karim',
      phone: '01755667788',
      placeText: 'Anwara, Chattogram',
      line: 'Road 12',
      landmark: null,
    },
    zone: { nameEn: 'Outside Dhaka', nameBn: null, etaMinDays: 3, etaMaxDays: 5 },
    history: [{ status: 'processing', at: '2026-10-24T12:19:00.000Z' }],
  };

  it('shows items, money, ship-to, note and ETA', () => {
    render(<OrderDetailView lang="en" o={o} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Order 2610-00003');
    expect(screen.getByText('Walton Dry Iron')).toBeInTheDocument();
    expect(screen.getAllByText('৳1,310').length).toBe(2);
    expect(screen.getByText('Anwara, Chattogram')).toBeInTheDocument();
    expect(screen.getByText(/Call before coming/)).toBeInTheDocument();
    expect(screen.getByText('Estimated delivery: 3-5 days after confirmation')).toBeInTheDocument();
    expect(screen.getByText(/Cash on delivery · To pay on delivery/)).toBeInTheDocument();
  });
});

describe('TrackForm', () => {
  const track = {
    orderNo: '2610-00001',
    status: 'processing',
    placedAt: '2026-10-24T12:16:00.000Z',
    maskedPhone: '017******44',
    itemCount: 2,
    grandTotalP: 42000,
    etaMinDays: 1,
    etaMaxDays: 2,
    timeline: [{ status: 'processing', at: '2026-10-24T12:16:00.000Z' }],
  };

  function stubFetch(res: { status: number; body: unknown }) {
    const f = vi.fn(async () => ({
      ok: res.status < 300,
      status: res.status,
      json: async () => res.body,
    }));
    vi.stubGlobal('fetch', f);
    return f;
  }

  it('validates, posts the normalised phone and shows the timeline with a masked phone', async () => {
    const f = stubFetch({ status: 200, body: track });
    render(<TrackForm lang="en" initialOrderNo="2610-00001" />);
    fireEvent.click(screen.getByRole('button', { name: d.trackButton }));
    expect(await screen.findByText(d.trackPhoneRequired)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(d.trackPhone), { target: { value: '+8801711223344' } });
    fireEvent.click(screen.getByRole('button', { name: d.trackButton }));
    expect(await screen.findByText('Order 2610-00001')).toBeInTheDocument();
    expect(f).toHaveBeenCalledWith(
      '/v1/public/track',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ orderNo: '2610-00001', phone: '01711223344' }),
      }),
    );
    expect(screen.getByText('Phone on order: 017******44')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: d.timeline })).toBeInTheDocument();
  });

  it('shows a friendly message when nothing matches or lookups are throttled', async () => {
    stubFetch({ status: 404, body: { code: 'ORDER_NOT_FOUND' } });
    render(<TrackForm lang="en" initialOrderNo="2610-00009" />);
    fireEvent.change(screen.getByLabelText(d.trackPhone), { target: { value: '01711223344' } });
    fireEvent.click(screen.getByRole('button', { name: d.trackButton }));
    expect(await screen.findByRole('alert')).toHaveTextContent(d.trackNotFound);

    stubFetch({ status: 429, body: { code: 'TOO_MANY_REQUESTS' } });
    fireEvent.click(screen.getByRole('button', { name: d.trackButton }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(d.trackTooMany));
  });
});

describe('AddressesManager', () => {
  const addr = {
    id: 'a1',
    label: 'Home',
    name: 'Karim',
    phone: '01755667788',
    districtId: 47,
    upazilaId: 1003,
    areaId: null,
    line: 'Road 9',
    landmark: null,
    isDefault: true,
    placeText: 'Gulshan, Dhaka',
  };

  beforeEach(() => {
    h.GET.mockImplementation(async (path: string) => {
      if (path.endsWith('/divisions')) return ok([{ id: 6, nameEn: 'Dhaka', nameBn: 'ঢাকা' }]);
      if (path.endsWith('/districts'))
        return ok([{ id: 47, nameEn: 'Dhaka', nameBn: 'ঢাকা', divisionId: 6 }]);
      if (path.endsWith('/upazilas'))
        return ok([{ id: 1003, nameEn: 'Gulshan', nameBn: 'গুলশান', districtId: 47 }]);
      return ok([addr]);
    });
  });

  it('lists addresses with the default marked, and deletes after a confirmation', async () => {
    h.DELETE.mockResolvedValue(ok({}));
    render(
      <AddressesManager
        lang="en"
        initial={[addr]}
        customerName="Karim"
        customerPhone="01755667788"
      />,
    );
    expect(screen.getByText(d.addrDefault)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: d.addrMakeDefault })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: d.addrDelete }));
    expect(h.DELETE).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: d.addrYesDelete }));
    await waitFor(() =>
      expect(h.DELETE).toHaveBeenCalledWith('/v1/customer/addresses/{id}', {
        params: { path: { id: 'a1' } },
      }),
    );
  });

  it('validates before saving a new address', async () => {
    render(
      <AddressesManager lang="en" initial={[]} customerName="Karim" customerPhone="01755667788" />,
    );
    fireEvent.click(screen.getByRole('button', { name: d.addrAdd }));
    fireEvent.click(await screen.findByRole('button', { name: d.addrSave }));
    expect(await screen.findAllByText(en.checkout.errors.placeRequired)).not.toHaveLength(0);
    expect(h.POST).not.toHaveBeenCalled();
  });

  it('edits a saved address (division is derived from its district)', async () => {
    h.PATCH.mockResolvedValue(ok({}));
    render(
      <AddressesManager
        lang="en"
        initial={[addr]}
        customerName="Karim"
        customerPhone="01755667788"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: d.addrEdit }));
    const division = (await screen.findByLabelText(en.checkout.division)) as HTMLSelectElement;
    await waitFor(() => expect(division.value).toBe('6'));
    fireEvent.change(screen.getByLabelText(en.checkout.line), { target: { value: 'Road 10' } });
    fireEvent.click(screen.getByRole('button', { name: d.addrSave }));
    await waitFor(() =>
      expect(h.PATCH).toHaveBeenCalledWith(
        '/v1/customer/addresses/{id}',
        expect.objectContaining({
          params: { path: { id: 'a1' } },
          body: expect.objectContaining({ line: 'Road 10', districtId: 47, upazilaId: 1003 }),
        }),
      ),
    );
  });
});
