import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '~/features/categories/http';
import { poErrorMessage } from '~/features/purchase-orders/errors';
import {
  canCancel,
  clampReceive,
  costAfterP,
  editMode,
  type LineDraft,
  lineError,
} from '~/features/purchase-orders/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  suppliers: vi.fn(),
  variantOptions: vi.fn(),
  create: vi.fn(),
  patch: vi.fn(),
  send: vi.fn(),
  receive: vi.fn(),
  close: vi.fn(),
  cancel: vi.fn(),
  print: vi.fn(),
}));

vi.mock('~/features/purchase-orders/api', () => ({ poApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { PoEditorPage } from '~/features/purchase-orders/PoEditorPage';
import { PurchaseOrdersPage } from '~/features/purchase-orders/PurchaseOrdersPage';
import { ReceiveModal } from '~/features/purchase-orders/ReceiveModal';

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

const item = (over: object = {}) => ({
  id: 'it1',
  variantId: 'v1',
  productId: 'p1',
  productTitleEn: 'Baby Wipes',
  sku: 'WIPE-1',
  options: [],
  qtyOrdered: 10,
  qtyReceived: 6,
  qtyRejected: 1,
  remaining: 3,
  unitCostP: 12000,
  lineTotalP: 120000,
  onHand: 20,
  variantCostP: 10000,
  ...over,
});

const po = (over: object = {}) => ({
  id: 'po1',
  poNo: 'PO-2610-0001',
  supplier: { id: 's1', name: 'Acme Ltd', phone: null, email: null, address: null },
  status: 'partially_received' as const,
  expectedAt: '2026-10-01',
  lineCount: 1,
  qtyOrdered: 10,
  qtyReceived: 6,
  qtyRejected: 1,
  subtotalP: 120000,
  receivedValueP: 72000,
  late: false,
  createdAt: '2026-09-20T00:00:00.000Z',
  sentAt: '2026-09-21T00:00:00.000Z',
  notes: 'Pack well',
  closeReason: null,
  closedAt: null,
  closedBy: null,
  createdBy: { id: 'u1', name: 'Owner' },
  items: [item()],
  receipts: [],
  ...over,
});

describe('logic', () => {
  it('costAfterP is the weighted average, rounded', () => {
    expect(costAfterP(10000, 20, 10, 13000)).toBe(11000);
    expect(costAfterP(10000, 3, 1, 10001)).toBe(10000);
    expect(costAfterP(null, 20, 5, 13000)).toBe(13000);
    expect(costAfterP(10000, 0, 5, 13000)).toBe(13000);
    expect(costAfterP(10000, 20, 0, 13000)).toBe(10000);
  });

  it('clampReceive keeps good + rejected within what is outstanding', () => {
    expect(clampReceive(5, 'good', 9, 0)).toEqual({ good: 5, rejected: 0 });
    expect(clampReceive(5, 'good', 4, 3)).toEqual({ good: 4, rejected: 1 });
    expect(clampReceive(5, 'rejected', 9, 2)).toEqual({ good: 0, rejected: 5 });
    expect(clampReceive(5, 'rejected', -3, 2)).toEqual({ good: 2, rejected: 0 });
  });

  it('lineError needs a line, a whole qty >= 1 and a cost', () => {
    const l = (o: Partial<LineDraft> = {}): LineDraft => ({
      key: 'a',
      variantId: 'a',
      title: 'T',
      sku: 'S1',
      options: [],
      qty: 2,
      unitCostP: 500,
      hint: null,
      ...o,
    });
    expect(lineError([])).toMatch(/at least one line/);
    expect(lineError([l({ qty: 0 })])).toMatch(/quantity/);
    expect(lineError([l({ qty: null })])).toMatch(/quantity/);
    expect(lineError([l({ unitCostP: null })])).toMatch(/unit cost/);
    expect(lineError([l({ unitCostP: 0 })])).toBeNull();
    expect(lineError([l()])).toBeNull();
  });

  it('editMode locks lines once sent; cancel only without receipts', () => {
    expect(editMode(null, true)).toBe('full');
    expect(editMode('draft', true)).toBe('full');
    expect(editMode('sent', true)).toBe('meta');
    expect(editMode('closed', true)).toBe('none');
    expect(editMode('draft', false)).toBe('none');
    expect(canCancel({ status: 'sent', receipts: [] })).toBe(true);
    expect(canCancel({ status: 'sent', receipts: [{}] as never })).toBe(false);
    expect(canCancel({ status: 'partially_received', receipts: [] })).toBe(false);
  });

  it('maps API codes to friendly text', () => {
    const err = (code: string, extra = {}) => new HttpError('raw', 409, { code, ...extra });
    expect(poErrorMessage(err('PO_LOCKED'))).toMatch(/already sent/);
    expect(poErrorMessage(err('PO_OVER_RECEIVE', { remaining: 2 }))).toMatch(/remaining: 2/);
    expect(poErrorMessage(new Error('Plain'))).toBe('Plain');
  });
});

describe('PurchaseOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.suppliers.mockResolvedValue({ items: [], total: 0 });
    mocks.list.mockResolvedValue({
      items: [
        po({ id: 'a', poNo: 'PO-A', status: 'sent', late: true, qtyReceived: 0, qtyRejected: 0 }),
        po({ id: 'b', poNo: 'PO-B', status: 'draft' }),
      ],
      total: 2,
      counts: {
        all: 5,
        draft: 1,
        sent: 2,
        partially_received: 1,
        received: 1,
        closed: 0,
        cancelled: 0,
      },
    });
  });

  it('shows status tabs with counts, a Late badge and Receive only on sent orders', async () => {
    wrap(<PurchaseOrdersPage />);
    await screen.findByText('PO-A');
    const tab = screen.getByRole('tab', { name: /Partially received/ });
    expect(within(tab).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /^All/ })).getByText('5')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /^Sent/ })).getByText('2')).toBeInTheDocument();
    const rowA = (await screen.findByText('PO-A')).closest('tr') as HTMLElement;
    expect(within(rowA).getByText('Late')).toBeInTheDocument();
    expect(within(rowA).getByRole('button', { name: 'Receive goods' })).toBeInTheDocument();
    const rowB = screen.getByText('PO-B').closest('tr') as HTMLElement;
    expect(within(rowB).queryByRole('button', { name: 'Receive goods' })).toBeNull();
  });

  it('filters by the clicked tab', async () => {
    wrap(<PurchaseOrdersPage />);
    fireEvent.click(await screen.findByRole('tab', { name: /^Draft/ }));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'draft' })),
    );
  });
});

describe('PoEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.suppliers.mockResolvedValue({
      items: [{ id: 's1', name: 'Acme Ltd', isActive: true }],
      total: 1,
    });
    mocks.variantOptions.mockResolvedValue([]);
  });

  it('new order: needs a supplier, then at least one line', async () => {
    wrap(<PoEditorPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Choose a supplier.')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('new order with a preset supplier but no lines is refused', async () => {
    wrap(<PoEditorPage supplierId="s1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send to supplier' }));
    expect(await screen.findByText('Add at least one line.')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('sent order: lines are read-only, notes and date still save', async () => {
    mocks.detail.mockResolvedValue(po({ status: 'sent', qtyReceived: 0, qtyRejected: 0 }));
    mocks.patch.mockResolvedValue({});
    wrap(<PoEditorPage id="po1" />);
    await screen.findByText('Remaining');
    expect(screen.queryByLabelText(/^Quantity/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send to supplier' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Notes to supplier'), { target: { value: 'Call me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('po1', {
        expectedAt: '2026-10-01',
        notes: 'Call me',
      }),
    );
  });

  it('draft order: lines are editable inputs', async () => {
    mocks.detail.mockResolvedValue(po({ status: 'draft', qtyReceived: 0, qtyRejected: 0 }));
    wrap(<PoEditorPage id="po1" />);
    expect(await screen.findByLabelText('Quantity WIPE-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit cost WIPE-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove WIPE-1' })).toBeInTheDocument();
  });
});

describe('ReceiveModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.receive.mockResolvedValue({});
  });

  it('defaults to the remaining qty, caps entries and previews the new average cost', async () => {
    const onClose = vi.fn();
    wrap(<ReceiveModal po={po() as never} onClose={onClose} />);
    const dialog = await screen.findByRole('dialog');
    const good = within(dialog).getByLabelText('Good WIPE-1') as HTMLInputElement;
    const rejected = within(dialog).getByLabelText('Rejected WIPE-1') as HTMLInputElement;
    expect(good.value).toBe('3');
    expect(rejected.value).toBe('0');
    // (20 x 100 + 3 x 120) / 23 = 102.60869 -> 102.61
    expect(within(dialog).getByTestId('cost-WIPE-1')).toHaveTextContent('৳102.61');
    expect(within(dialog).getByTestId('after-WIPE-1')).toHaveTextContent('23');

    fireEvent.change(good, { target: { value: '99' } });
    expect(good.value).toBe('3');
    fireEvent.change(good, { target: { value: '2' } });
    fireEvent.change(rejected, { target: { value: '5' } });
    expect(rejected.value).toBe('0');
    fireEvent.change(rejected, { target: { value: '1' } });
    expect(rejected.value).toBe('1');
    expect(good.value).toBe('2');
    expect(within(dialog).getByTestId('after-WIPE-1')).toHaveTextContent('22');

    fireEvent.change(within(dialog).getByLabelText(/Receiving note/), {
      target: { value: 'dented' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm receipt/ }));
    await waitFor(() =>
      expect(mocks.receive).toHaveBeenCalledWith('po1', {
        note: 'dented',
        items: [{ poItemId: 'it1', qtyGood: 2, qtyRejected: 1 }],
      }),
    );
  });

  it('refuses an all-zero receipt', async () => {
    wrap(<ReceiveModal po={po() as never} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Good WIPE-1'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm receipt/ }));
    expect(await within(dialog).findByText(/at least one line/)).toBeInTheDocument();
    expect(mocks.receive).not.toHaveBeenCalled();
  });
});
