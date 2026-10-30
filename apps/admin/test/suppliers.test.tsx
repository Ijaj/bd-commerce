import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '~/features/categories/http';
import { friendlyMessage } from '~/features/suppliers/errors';
import { adjustmentBody, canReverse, overpays, paymentBody } from '~/features/suppliers/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  pay: vi.fn(),
  adjust: vi.fn(),
  reverse: vi.fn(),
  ledger: vi.fn(),
}));

vi.mock('~/features/suppliers/api', () => ({ suppliersApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { AddSupplierModal } from '~/features/suppliers/AddSupplierModal';
import { LedgerTab } from '~/features/suppliers/LedgerTab';
import { PaymentModal } from '~/features/suppliers/PaymentModal';
import { SuppliersPage } from '~/features/suppliers/SuppliersPage';

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} env="test">
        <Notifications />
        {ui}
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const row = (o: object) => ({
  id: 's1',
  name: 'Rahim Traders',
  contactName: 'Rahim',
  phone: '01711111111',
  email: null,
  shipMode: 'direct_to_customer',
  paymentTerms: null,
  isActive: true,
  productCount: 4,
  openPoCount: 2,
  balanceP: 250000,
  ...o,
});

const entry = (o: object) => ({
  id: 'e1',
  type: 'payment',
  amountP: -10000,
  balanceAfterP: 5000,
  method: 'cash',
  reference: null,
  note: null,
  poReceiptId: null,
  poId: null,
  poNo: null,
  reversesId: null,
  reversedById: null,
  recordedBy: { id: 'u1', name: 'Owner' },
  at: '2026-10-30T10:00:00.000Z',
  ...o,
});

describe('supplier logic', () => {
  it('payment needs an amount, and a reference unless cash', () => {
    expect(paymentBody({ amountP: null, method: 'cash', reference: '', note: '' })).toHaveProperty(
      'error',
    );
    expect(paymentBody({ amountP: 500, method: 'bkash', reference: ' ', note: '' })).toHaveProperty(
      'error',
    );
    expect(paymentBody({ amountP: 500, method: 'cash', reference: '', note: '' })).toEqual({
      amountP: 500,
      method: 'cash',
    });
    expect(
      paymentBody({ amountP: 500, method: 'nagad', reference: ' TX1 ', note: ' hi ' }),
    ).toEqual({ amountP: 500, method: 'nagad', reference: 'TX1', note: 'hi' });
  });

  it('adjustment signs by direction and needs a reason', () => {
    expect(adjustmentBody('owe_more', 100, ' fee ')).toEqual({ amountP: 100, note: 'fee' });
    expect(adjustmentBody('owe_less', 100, 'discount')).toEqual({
      amountP: -100,
      note: 'discount',
    });
    expect(adjustmentBody('owe_more', 0, 'xxx')).toHaveProperty('error');
    expect(adjustmentBody('owe_more', 100, 'ab')).toHaveProperty('error');
  });

  it('only payments and adjustments that are not reversed can be reversed', () => {
    expect(canReverse({ type: 'payment', reversedById: null })).toBe(true);
    expect(canReverse({ type: 'adjustment', reversedById: null })).toBe(true);
    expect(canReverse({ type: 'payment', reversedById: 'r' })).toBe(false);
    expect(canReverse({ type: 'receipt', reversedById: null })).toBe(false);
    expect(canReverse({ type: 'reversal', reversedById: null })).toBe(false);
  });

  it('warns only when a payment exceeds what is owed', () => {
    expect(overpays(5000, 4000)).toBe(true);
    expect(overpays(4000, 4000)).toBe(false);
    expect(overpays(100, -500)).toBe(true);
    expect(overpays(null, 100)).toBe(false);
  });

  it('rewrites known error codes', () => {
    const err = new HttpError('raw', 422, { message: 'raw', code: 'SUPPLIER_PHONE_INVALID' });
    expect(friendlyMessage(err, 'x')).toMatch(/mobile number/);
    expect(friendlyMessage(new Error('Plain'), 'x')).toBe('Plain');
  });
});

describe('SuppliersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({
      items: [row({}), row({ id: 's2', name: 'Karim & Co', balanceP: -5000, isActive: false })],
      total: 2,
    });
  });

  it('lists suppliers with balance, credit and status', async () => {
    wrap(<SuppliersPage />);
    expect(await screen.findByText('Rahim Traders')).toBeInTheDocument();
    expect(screen.getByText('৳2,500')).toBeInTheDocument();
    expect(screen.getByText('Credit ৳50')).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Active')).toBeInTheDocument();
    expect(table.getByText('Paused')).toBeInTheDocument();
    expect(screen.getAllByText('Ship direct to customer').length).toBe(2);
  });

  it('sends the search text to the API', async () => {
    wrap(<SuppliersPage />);
    await screen.findByText('Rahim Traders');
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'karim' } });
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'karim', page: 1 })),
    );
  });
});

describe('AddSupplierModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'new1' });
  });

  it('requires a company name', async () => {
    wrap(<AddSupplierModal onClose={() => {}} onCreated={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    expect(await within(dialog).findByText('Company name is required')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('posts trimmed values and empty text as null', async () => {
    const onCreated = vi.fn();
    wrap(<AddSupplierModal onClose={() => {}} onCreated={onCreated} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Company name/), {
      target: { value: ' Rahim Traders ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Phone'), { target: { value: '01711111111' } });
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      name: 'Rahim Traders',
      phone: '01711111111',
      contactName: null,
      shipMode: 'direct_to_customer',
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pay.mockResolvedValue({});
  });

  it('converts taka to paisa for a cash payment', async () => {
    wrap(
      <PaymentModal supplierId="s1" supplierName="Rahim" balanceP={250000} onClose={() => {}} />,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '125.50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() =>
      expect(mocks.pay).toHaveBeenCalledWith('s1', { amountP: 12550, method: 'cash' }),
    );
  });

  it('requires a reference for bKash and warns on overpayment', async () => {
    wrap(<PaymentModal supplierId="s1" supplierName="Rahim" balanceP={1000} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '50' } });
    expect(await within(dialog).findByText(/more than we owe/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByLabelText('Method')[0] as HTMLElement);
    fireEvent.click(await screen.findByRole('option', { name: 'bKash' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await within(dialog).findByText(/reference is required for bKash/i)).toBeInTheDocument();
    expect(mocks.pay).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^Reference/), { target: { value: 'TX99' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() =>
      expect(mocks.pay).toHaveBeenCalledWith('s1', {
        amountP: 5000,
        method: 'bkash',
        reference: 'TX99',
      }),
    );
  });
});

describe('LedgerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ledger.mockResolvedValue({
      balanceP: 5000,
      total: 4,
      items: [
        entry({ id: 'p1' }),
        entry({ id: 'p2', reversedById: 'r1' }),
        entry({
          id: 'r0',
          type: 'receipt',
          amountP: 20000,
          poNo: 'PO-1',
          poId: 'po1',
          method: null,
        }),
        entry({ id: 'a1', type: 'adjustment', amountP: 300 }),
      ],
    });
  });

  it('offers Reverse only on payments and adjustments not yet reversed', async () => {
    wrap(<LedgerTab supplierId="s1" supplierName="Rahim" canPay />);
    await screen.findByText('Goods received');
    expect(screen.getAllByRole('button', { name: 'Reverse' })).toHaveLength(2);
    expect(screen.getByText('Reversed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument();
  });

  it('hides money actions without supplier_payments.manage', async () => {
    wrap(<LedgerTab supplierId="s1" supplierName="Rahim" canPay={false} />);
    await screen.findByText('Goods received');
    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
  });

  it('asks for a reason before reversing', async () => {
    mocks.reverse.mockResolvedValue({});
    wrap(<LedgerTab supplierId="s1" supplierName="Rahim" canPay />);
    await screen.findByText('Goods received');
    fireEvent.click(screen.getAllByRole('button', { name: 'Reverse' })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reverse' }));
    expect(await within(dialog).findByText(/at least 3 characters/)).toBeInTheDocument();
    expect(mocks.reverse).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: 'typo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reverse' }));
    await waitFor(() => expect(mocks.reverse).toHaveBeenCalledWith('p1', 'typo'));
  });
});
