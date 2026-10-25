import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ POST: vi.fn(), push: vi.fn() }));

vi.mock('~/lib/api-browser', () => ({ browserApi: { POST: h.POST } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OrderDetailView } from '~/features/orders/OrderDetailView';
import { InvoiceView } from '~/features/returns/InvoiceView';
import {
  buildReturnBody,
  canRequestReturn,
  canViewInvoice,
  returnableLines,
  returnSteps,
} from '~/features/returns/logic';
import { ReturnDetailView } from '~/features/returns/ReturnDetailView';
import { ReturnForm } from '~/features/returns/ReturnForm';
import { ReturnList } from '~/features/returns/ReturnList';
import type { CustomerReturn, InvoiceDetail, OrderForReturn } from '~/features/returns/types';
import { bn } from '~/i18n/bn';
import { en } from '~/i18n/en';

const d = en.returns;

function order(over: Partial<OrderForReturn> = {}): OrderForReturn {
  return {
    orderNo: '2610-00003',
    placedAt: '2026-10-24T12:19:00.000Z',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    lang: 'en',
    isPreorder: false,
    customerNote: null,
    items: [
      {
        productId: 'p',
        variantId: 'v',
        orderItemId: 'oi-1',
        returnableQty: 2,
        slug: 'iron',
        title: 'Walton Dry Iron',
        sku: 'S',
        optionsText: null,
        image: null,
        qty: 2,
        qtyCancelled: 0,
        unitPriceP: 119000,
        lineTotalP: 238000,
        discountP: 0,
      },
    ],
    discounts: [],
    money: {
      subtotalP: 238000,
      autoDiscountP: 0,
      couponDiscountP: 0,
      deliveryChargeP: 12000,
      deliveryDiscountP: 0,
      grandTotalP: 250000,
      paidP: 0,
      refundedP: 0,
      codDueP: 250000,
    },
    shipTo: {
      name: 'Karim',
      phone: '01755667788',
      placeText: 'Anwara',
      line: 'Road 12',
      landmark: null,
    },
    zone: { nameEn: 'Outside Dhaka', nameBn: null, etaMinDays: 3, etaMaxDays: 5 },
    history: [{ status: 'delivered', at: '2026-10-25T12:19:00.000Z' }],
    ...over,
  };
}

beforeEach(() => {
  h.POST.mockReset();
  h.push.mockReset();
});

describe('return logic', () => {
  it('marks done, current and upcoming steps', () => {
    const steps = returnSteps('pickup_booked');
    expect(steps.map((s) => s.state)).toEqual([
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('ends the path at rejected', () => {
    expect(returnSteps('rejected').map((s) => s.status)).toEqual(['requested', 'rejected']);
  });

  it('offers a return only for delivered orders with units left', () => {
    expect(canRequestReturn(order())).toBe(true);
    expect(canRequestReturn(order({ status: 'shipped' }))).toBe(false);
    const none = order();
    (none.items[0] as { returnableQty: number }).returnableQty = 0;
    expect(canRequestReturn(none)).toBe(false);
    expect(returnableLines(none)).toHaveLength(0);
  });

  it('lets the API decide when it reports no returnable quantity', () => {
    const o = order();
    o.items[0] = { ...o.items[0], returnableQty: undefined } as OrderForReturn['items'][number];
    expect(canRequestReturn(o)).toBe(true);
  });

  it('shows the invoice link once shipped', () => {
    expect(canViewInvoice({ status: 'shipped' })).toBe(true);
    expect(canViewInvoice({ status: 'processing' })).toBe(false);
  });

  it('builds the request body from checked lines only', () => {
    const body = buildReturnBody('N1', {
      a: { checked: true, qty: 2, reason: 'damaged', note: ' cracked ' },
      b: { checked: false, qty: 1, reason: 'other', note: '' },
    });
    expect(body).toEqual({
      orderNo: 'N1',
      items: [{ orderItemId: 'a', qty: 2, reason: 'damaged', note: 'cracked' }],
    });
  });
});

describe('ReturnForm', () => {
  it('requires at least one item', () => {
    render(<ReturnForm lang="en" order={order()} />);
    fireEvent.click(screen.getByRole('button', { name: d.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(d.pickOne);
    expect(h.POST).not.toHaveBeenCalled();
  });

  it('sends the request and opens the new return', async () => {
    h.POST.mockResolvedValue({ data: { returnNo: 'R-1' }, response: { ok: true, status: 201 } });
    render(<ReturnForm lang="en" order={order()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(d.reasonLabel), { target: { value: 'damaged' } });
    fireEvent.change(screen.getByLabelText(d.qty), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: d.submit }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/account/returns/R-1'));
    expect(h.POST).toHaveBeenCalledWith('/v1/customer/returns', {
      body: {
        orderNo: '2610-00003',
        items: [{ orderItemId: 'oi-1', qty: 2, reason: 'damaged' }],
      },
    });
  });

  it('shows the API error for a closed window', async () => {
    h.POST.mockResolvedValue({
      error: { statusCode: 409, code: 'RETURN_WINDOW_CLOSED', message: 'closed' },
      response: { ok: false, status: 409 },
    });
    render(<ReturnForm lang="en" order={order()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: d.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(d.errors.RETURN_WINDOW_CLOSED);
    expect(h.push).not.toHaveBeenCalled();
  });
});

const ret: CustomerReturn = {
  returnNo: 'R-1',
  orderNo: '2610-00003',
  status: 'approved',
  fault: 'ours',
  returnShippingP: 0,
  rejectReason: null,
  requestedAt: '2026-10-25T12:00:00.000Z',
  items: [
    {
      orderItemId: 'oi-1',
      titleSnapshot: 'Walton Dry Iron',
      sku: 'S',
      optionsText: null,
      qty: 1,
      reason: 'defective',
      note: null,
    },
  ],
  mediaIds: [],
  refunds: [{ id: 'rf', amountP: 119000, method: 'original', status: 'processing' }],
};

describe('ReturnList and ReturnDetailView', () => {
  it('links each return with its status', () => {
    render(<ReturnList lang="en" data={{ items: [ret], total: 1, page: 1, limit: 10 }} />);
    expect(screen.getByRole('link', { name: /R-1/ })).toHaveAttribute(
      'href',
      '/account/returns/R-1',
    );
    expect(screen.getByText(d.status.approved)).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    render(<ReturnList lang="en" data={{ items: [], total: 0, page: 1, limit: 10 }} />);
    expect(screen.getByText(d.listEmpty)).toBeInTheDocument();
  });

  it('shows progress, items and refunds, in Bangla too', () => {
    render(<ReturnDetailView lang="en" r={ret} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Return R-1');
    expect(screen.getByText(d.statusHint.approved)).toBeInTheDocument();
    expect(screen.getByText(/Walton Dry Iron/)).toBeInTheDocument();
    expect(screen.getByText(/Original payment method · Processing/)).toBeInTheDocument();
    render(<ReturnDetailView lang="bn" r={ret} />);
    expect(screen.getAllByText(bn.returns.status.approved).length).toBeGreaterThan(0);
  });

  it('shows the reason when rejected', () => {
    render(
      <ReturnDetailView lang="en" r={{ ...ret, status: 'rejected', rejectReason: 'Used item' }} />,
    );
    expect(screen.getByText('Reason given: Used item')).toBeInTheDocument();
  });
});

describe('OrderDetailView return and invoice links', () => {
  it('shows both for a delivered order', () => {
    render(<OrderDetailView lang="en" o={order()} />);
    expect(screen.getByRole('link', { name: d.invoice })).toHaveAttribute(
      'href',
      '/order/2610-00003/invoice',
    );
    expect(screen.getByRole('link', { name: d.requestReturn })).toHaveAttribute(
      'href',
      '/account/returns/new?order=2610-00003',
    );
  });

  it('shows neither while processing', () => {
    render(<OrderDetailView lang="en" o={order({ status: 'processing' })} />);
    expect(screen.queryByRole('link', { name: d.invoice })).toBeNull();
    expect(screen.queryByRole('link', { name: d.requestReturn })).toBeNull();
  });
});

describe('InvoiceView', () => {
  const inv: InvoiceDetail = {
    id: 'i',
    orderId: 'o',
    orderNo: '2610-00003',
    invoiceNo: 'INV-2610-00003',
    issuedAt: '2026-10-25T12:00:00.000Z',
    vatRateBp: 1500,
    vatTotalP: 32609,
    grandTotalP: 250000,
    bin: null,
    isCurrent: true,
    snapshot: {
      lang: 'en',
      store: {
        name: 'ShopName',
        address: 'Dhaka',
        phone: '0170',
        email: 'a@b.c',
        bin: '123',
        vatRateBp: 1500,
      },
      orderNo: '2610-00003',
      orderDate: '2026-10-24T12:19:00.000Z',
      paymentMethod: 'cod',
      billTo: { name: 'Karim', phone: '01755667788', email: null },
      shipTo: { name: 'Karim', phone: '01755667788', address: 'Road 12', placeText: 'Anwara' },
      lines: [
        {
          titleSnapshot: 'Walton Dry Iron',
          sku: 'S',
          optionsText: null,
          qty: 2,
          unitPriceP: 119000,
          lineTotalP: 238000,
        },
      ],
      subtotalP: 238000,
      autoDiscountP: 0,
      couponDiscountP: 0,
      deliveryChargeP: 12000,
      deliveryDiscountP: 0,
      grandTotalP: 250000,
      paidP: 0,
      codDueP: 250000,
      vat: { rateBp: 1500, totalP: 32609, netP: 217391 },
    },
  };

  it('renders lines, totals and the VAT note', () => {
    render(<InvoiceView lang="en" inv={inv} />);
    expect(screen.getByText(/Walton Dry Iron/)).toBeInTheDocument();
    expect(screen.getAllByText('৳2,500').length).toBeGreaterThan(0);
    expect(screen.getByText(/Prices include VAT/)).toHaveTextContent('15%');
    expect(screen.getByRole('button', { name: d.inv.print })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'বাংলা' })).toHaveAttribute(
      'href',
      '/bn/order/2610-00003/invoice',
    );
  });

  it('uses Bangla labels and digits', () => {
    render(<InvoiceView lang="bn" inv={inv} />);
    expect(screen.getByText(bn.returns.inv.billTo)).toBeInTheDocument();
    expect(screen.getAllByText('৳২,৫০০').length).toBeGreaterThan(0);
  });

  it('prints only on button click', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<InvoiceView lang="en" inv={inv} />);
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: d.inv.print }));
    expect(print).toHaveBeenCalledOnce();
  });
});
