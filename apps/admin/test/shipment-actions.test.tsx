import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '~/features/categories/http';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({ cancel: vi.fn() }));
vi.mock('~/features/shipments/api', () => ({ shipmentsApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));

import type { Shipment } from '~/features/shipments/logic';
import { ShipmentActions } from '~/features/shipments/ShipmentActions';

const booked = {
  id: 's1',
  shipmentNo: 'SHP-1',
  orderNo: 'O-1',
  status: 'booked',
  courier: { code: 'steadfast', name: 'Steadfast' },
  codAmountP: 50000,
} as unknown as Shipment;

describe('ShipmentActions cancel', () => {
  it('falls back to "Mark cancelled manually" when the courier cannot cancel', async () => {
    mocks.cancel
      .mockRejectedValueOnce(
        new HttpError('Courier refused', 502, { code: 'COURIER_CANCEL_FAILED', message: 'no' }),
      )
      .mockResolvedValueOnce({});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MantineProvider theme={theme} env="test">
          <Notifications />
          <ShipmentActions shipment={booked} />
        </MantineProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(await screen.findByText('Cancel shipment'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel shipment' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('s1', false));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark cancelled manually' }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenLastCalledWith('s1', true));
  });
});
