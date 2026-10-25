import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from './utils';

vi.mock('@tanstack/react-router', () => ({ Outlet: () => null }));

import { InvoiceView } from '~/features/documents/InvoiceView';
import { LabelView } from '~/features/documents/LabelView';
import type { InvoiceDetail, Label } from '~/features/documents/queries';

const invoice: InvoiceDetail = {
  id: 'i1',
  orderId: 'o1',
  orderNo: '2610-00012',
  invoiceNo: 'INV-2610-00012',
  issuedAt: '2026-10-25T06:00:00.000Z',
  vatRateBp: 500,
  vatTotalP: 4762,
  grandTotalP: 100000,
  bin: '123',
  isCurrent: true,
  snapshot: {
    lang: 'en',
    store: {
      name: 'BD Shop',
      address: 'Dhaka',
      phone: '01700000000',
      email: 's@x.bd',
      bin: '123',
      vatRateBp: 500,
    },
    orderNo: '2610-00012',
    orderDate: '2026-10-25T05:00:00.000Z',
    paymentMethod: 'cod',
    billTo: { name: 'Rahim', phone: '01711111111', email: null },
    shipTo: { name: 'Rahim', phone: '01711111111', address: 'House 1', placeText: 'Mirpur, Dhaka' },
    lines: [
      {
        titleSnapshot: 'Baby Cot',
        sku: 'COT-1',
        optionsText: 'Blue',
        qty: 2,
        unitPriceP: 45000,
        lineTotalP: 90000,
      },
    ],
    subtotalP: 90000,
    autoDiscountP: 0,
    couponDiscountP: 0,
    deliveryChargeP: 10000,
    deliveryDiscountP: 0,
    grandTotalP: 100000,
    paidP: 0,
    codDueP: 100000,
    vat: { rateBp: 500, totalP: 4762, netP: 95238 },
  },
};

describe('InvoiceView', () => {
  it('shows the VAT-inclusive portion with English digits', () => {
    render(<InvoiceView invoice={invoice} lang="en" />);
    expect(screen.getByText('VAT included (5%)')).toBeInTheDocument();
    expect(screen.getByText('৳47.62')).toBeInTheDocument();
    expect(screen.getByText('Cash on delivery', { exact: false })).toBeInTheDocument();
  });
  it('uses Bangla digits for money and quantity but keeps order numbers English', () => {
    render(<InvoiceView invoice={invoice} lang="bn" />);
    expect(screen.getAllByText('৳১,০০০').length).toBeGreaterThan(0);
    expect(screen.getByText('২')).toBeInTheDocument();
    expect(screen.getByText('ইনভয়েস নং: INV-2610-00012')).toBeInTheDocument();
  });
});

describe('LabelView', () => {
  const label: Label = {
    shipmentNo: 'SHP-2610-00001',
    orderNo: '2610-00012',
    barcodeValue: 'SHP-2610-00001',
    courier: { code: 'steadfast', name: 'Steadfast' },
    consignmentId: 'C123',
    store: { name: 'BD Shop', phone: '01700000000' },
    to: { name: 'Rahim', phone: '01711111111', address: 'House 1', placeText: 'Mirpur, Dhaka' },
    codAmountP: 100000,
    weightG: 800,
    itemsText: '2 x Baby Cot',
    note: null,
    printedAt: '2026-10-25T06:00:00.000Z',
  };
  beforeAll(() => {
    // jsbarcode measures text on a canvas; jsdom has none.
    HTMLCanvasElement.prototype.getContext = (() => ({
      measureText: () => ({ width: 10 }),
    })) as never;
  });
  it('renders COD, tracking and a barcode svg', () => {
    renderWithMantine(<LabelView label={label} />);
    expect(screen.getByText('COD ৳1,000')).toBeInTheDocument();
    expect(screen.getByText('Tracking: C123')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Barcode SHP-2610-00001' }).querySelector('rect'),
    ).not.toBeNull();
  });
  it('marks a zero-COD parcel as prepaid', () => {
    renderWithMantine(<LabelView label={{ ...label, codAmountP: 0 }} />);
    expect(screen.getByText('PREPAID')).toBeInTheDocument();
  });
});
