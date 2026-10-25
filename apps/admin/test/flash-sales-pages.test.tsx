import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  replaceItems: vi.fn(),
  searchVariants: vi.fn(),
  productPrices: vi.fn(),
}));

vi.mock('~/features/flash-sales/api', async (orig) => ({
  ...(await orig<typeof import('~/features/flash-sales/api')>()),
  flashApi: mocks,
}));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { HttpError } from '~/features/categories/http';
import { FlashSaleEditorPage } from '~/features/flash-sales/FlashSaleEditorPage';
import { FlashSalesPage } from '~/features/flash-sales/FlashSalesPage';

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

const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  variantId: 'v1',
  productId: 'p1',
  productTitleEn: 'Blue Romper',
  sku: 'BR-1',
  priceP: 100000,
  currentSalePriceP: null,
  flashPriceP: 80000,
  qtyLimit: 10,
  qtySold: 0,
  perCustomerLimit: null,
  sort: 0,
  ...over,
});

const sale = (items: unknown[] = [item()]) => ({
  id: 's1',
  nameEn: 'Eid Rush',
  nameBn: null,
  startsAt: '2026-11-01T06:00:00.000Z',
  endsAt: '2026-11-02T06:00:00.000Z',
  isActive: true,
  phase: 'scheduled',
  itemCount: items.length,
  unitsSold: 0,
  items,
});

beforeEach(() => vi.clearAllMocks());

describe('FlashSalesPage', () => {
  it('lists sales with a phase badge', async () => {
    mocks.list.mockResolvedValue({
      items: [{ ...sale(), items: undefined, itemCount: 3, unitsSold: 7, phase: 'live' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    wrap(<FlashSalesPage />);
    await screen.findByText('Eid Rush');
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Live')).toBeInTheDocument();
    expect(table.getByText('7')).toBeInTheDocument();
  });
});

describe('FlashSaleEditorPage items', () => {
  it('keeps sold items from being removed', async () => {
    mocks.detail.mockResolvedValue(sale([item({ qtySold: 4 })]));
    wrap(<FlashSaleEditorPage id="s1" />);
    await screen.findByText('Blue Romper');
    expect(screen.getByRole('button', { name: 'Remove BR-1' })).toBeDisabled();
  });

  it('blocks saving a flash price at or above the regular price', async () => {
    mocks.detail.mockResolvedValue(sale());
    wrap(<FlashSaleEditorPage id="s1" />);
    await screen.findByText('Blue Romper');
    const price = screen.getByLabelText('Flash price for BR-1');
    fireEvent.change(price, { target: { value: '1000' } });
    fireEvent.blur(price);
    expect(await screen.findByRole('button', { name: 'Save items' })).toBeDisabled();
    expect(screen.getByText(/below the regular price/)).toBeInTheDocument();
  });

  it('saves the edited list in paisa', async () => {
    mocks.detail.mockResolvedValue(sale());
    mocks.replaceItems.mockResolvedValue(sale([item({ flashPriceP: 70000 })]));
    wrap(<FlashSaleEditorPage id="s1" />);
    await screen.findByText('Blue Romper');
    const price = screen.getByLabelText('Flash price for BR-1');
    fireEvent.change(price, { target: { value: '700' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));
    await waitFor(() =>
      expect(mocks.replaceItems).toHaveBeenCalledWith('s1', [
        { variantId: 'v1', flashPriceP: 70000, qtyLimit: 10, perCustomerLimit: null, sort: 0 },
      ]),
    );
  });

  it('shows the overlap message with the other sale name', async () => {
    mocks.detail.mockResolvedValue(sale());
    mocks.replaceItems.mockRejectedValue(
      new HttpError('BR-1 is already in "Winter" at the same time', 409, {
        code: 'FLASH_OVERLAP',
        saleName: 'Winter',
      }),
    );
    wrap(<FlashSaleEditorPage id="s1" />);
    await screen.findByText('Blue Romper');
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));
    expect(await screen.findByText(/already in "Winter"/)).toBeInTheDocument();
  });

  it('finds a variant by SKU and adds it with its regular price', async () => {
    mocks.detail.mockResolvedValue(sale([]));
    mocks.searchVariants.mockResolvedValue({
      items: [
        {
          variantId: 'v9',
          productId: 'p9',
          productTitleEn: 'Red Dress',
          sku: 'RD-9',
          optionLabels: [{ en: 'M', bn: null }],
          available: 12,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    mocks.productPrices.mockResolvedValue({ variants: [{ id: 'v9', priceP: 250000 }] });
    wrap(<FlashSaleEditorPage id="s1" />);
    await screen.findByText('No items yet.');
    fireEvent.click(screen.getByRole('button', { name: /Add variant/ }));
    fireEvent.change(await screen.findByPlaceholderText(/SKU or product title/), {
      target: { value: 'RD-9' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    // The picker row has the same title, so wait for the table row (and the modal to close).
    await waitFor(() => {
      const table = within(screen.getByRole('table'));
      expect(table.getByText('Red Dress (M)')).toBeInTheDocument();
      expect(table.getByText('৳2,500')).toBeInTheDocument();
    });
  });
});
