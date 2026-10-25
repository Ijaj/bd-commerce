import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn(),
  undo: vi.fn(),
  products: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('~/features/bulk-sales/api', () => ({ bulkApi: mocks }));
// The real picker reads categories/brands/products; its own behaviour is not under test here.
vi.mock('~/features/bulk-sales/ScopePicker', () => ({
  ScopePicker: ({ onChange, value }: { onChange: (v: unknown) => void; value: object }) => (
    <button type="button" onClick={() => onChange({ ...value, categoryIds: ['c1'] })}>
      pick category
    </button>
  ),
}));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useNavigate: () => mocks.navigate,
}));

import { BulkSaleDetailPage } from '~/features/bulk-sales/BulkSaleDetailPage';
import { BulkSaleNewPage } from '~/features/bulk-sales/BulkSaleNewPage';
import { BulkSalesPage } from '~/features/bulk-sales/BulkSalesPage';

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

const batch = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  name: 'Winter clearance',
  mode: 'percent',
  value: 1500,
  scope: { productIds: [], categoryIds: ['c1'], brandIds: [] },
  startsAt: null,
  endsAt: null,
  createdAt: '2026-10-25T08:00:00.000Z',
  createdByName: 'Sara',
  undoneAt: null,
  itemCount: 2,
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  ...batch(),
  items: [
    {
      variantId: 'v1',
      sku: 'BR-1',
      title: 'Blue Romper',
      priceP: 100000,
      prevSalePriceP: null,
      newSalePriceP: 85000,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 50,
  ...over,
});

const previewResult = (over: Record<string, unknown> = {}) => ({
  count: 2,
  skipped: 1,
  skippedExisting: 1,
  skippedPrice: 0,
  tooMany: false,
  limit: 5000,
  sample: [
    {
      variantId: 'v1',
      sku: 'BR-1',
      title: 'Blue Romper',
      priceP: 100000,
      currentSalePriceP: null,
      newSalePriceP: 85000,
    },
  ],
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('BulkSalesPage', () => {
  it('lists batches with their status', async () => {
    mocks.list.mockResolvedValue({
      items: [batch(), batch({ id: 'b2', name: 'Old', undoneAt: '2026-10-25T09:00:00.000Z' })],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    wrap(<BulkSalesPage />);
    await screen.findByText('Winter clearance');
    expect(screen.getAllByText('15% off')).toHaveLength(2);
    expect(screen.getByText('Undone')).toBeInTheDocument();
    expect(screen.getAllByText('Applied')).toHaveLength(2);
  });
});

describe('BulkSaleNewPage', () => {
  async function fillRule() {
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Winter clearance' } });
    fireEvent.click(screen.getByRole('button', { name: 'pick category' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Percent off' }), {
      target: { value: '15' },
    });
  }

  it('previews first, then applies only after a confirm', async () => {
    mocks.preview.mockResolvedValue(previewResult());
    mocks.apply.mockResolvedValue(batch());
    wrap(<BulkSaleNewPage />);
    await fillRule();
    expect(screen.getByRole('button', { name: 'Apply sale prices' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/2 variants will get a sale price/);
    expect(screen.getByText(/1 skipped: already on sale/)).toBeInTheDocument();
    expect(mocks.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'percent',
        value: 1500,
        scope: expect.objectContaining({ categoryIds: ['c1'] }),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Apply sale prices' }));
    expect(mocks.apply).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Winter clearance', value: 1500 }),
      ),
    );
  });

  it('forgets the preview when the rule changes', async () => {
    mocks.preview.mockResolvedValue(previewResult());
    wrap(<BulkSaleNewPage />);
    await fillRule();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/will get a sale price/);
    fireEvent.change(screen.getByRole('textbox', { name: 'Percent off' }), {
      target: { value: '20' },
    });
    await waitFor(() =>
      expect(screen.queryByText(/will get a sale price/)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Apply sale prices' })).toBeDisabled();
  });

  it('does not allow applying a preview that is too broad', async () => {
    mocks.preview.mockResolvedValue(previewResult({ tooMany: true, count: 9000 }));
    wrap(<BulkSaleNewPage />);
    await fillRule();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(/matches too many variants/);
    expect(screen.getByRole('button', { name: 'Apply sale prices' })).toBeDisabled();
  });
});

describe('BulkSaleDetailPage', () => {
  it('undoes after confirming and reports variants left alone', async () => {
    mocks.detail.mockResolvedValue(detail());
    mocks.undo.mockResolvedValue({ restored: 1, skippedChanged: 1 });
    wrap(<BulkSaleDetailPage id="b1" />);
    await screen.findByText('Blue Romper');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(mocks.undo).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1) as HTMLElement);
    await waitFor(() => expect(mocks.undo).toHaveBeenCalledWith('b1'));
    expect(await screen.findByText(/1 were left as they are/)).toBeInTheDocument();
  });

  it('hides Undo for an undone batch', async () => {
    mocks.detail.mockResolvedValue(detail({ undoneAt: '2026-10-25T09:00:00.000Z' }));
    wrap(<BulkSaleDetailPage id="b1" />);
    await screen.findByText('Blue Romper');
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});
