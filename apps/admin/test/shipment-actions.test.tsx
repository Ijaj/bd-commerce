import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '~/features/categories/http';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), receivedBack: vi.fn() }));
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

describe('ShipmentActions received back', () => {
  const failed = {
    ...booked,
    id: 's2',
    shipmentNo: 'SHP-2',
    status: 'failed',
    receivedBackAt: null,
  } as unknown as Shipment;

  function mount(shipment: Shipment) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MantineProvider theme={theme} env="test">
          <Notifications />
          <ShipmentActions shipment={shipment} />
        </MantineProvider>
      </QueryClientProvider>,
    );
  }

  it('sends the note and the re-ship choice', async () => {
    mocks.receivedBack.mockResolvedValue({ warnings: [] });
    mount(failed);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Received back' }));
    fireEvent.change(await screen.findByLabelText('Note'), {
      target: { value: 'customer refused' },
    });
    fireEvent.click(screen.getByLabelText('Re-ship these items'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm received back' }));
    await waitFor(() =>
      expect(mocks.receivedBack).toHaveBeenCalledWith('s2', {
        note: 'customer refused',
        reship: true,
      }),
    );
  });

  it('defaults to not re-shipping and shows an API refusal', async () => {
    mocks.receivedBack.mockRejectedValue(
      new HttpError('Already received back', 409, { code: 'SHIPMENT_STATE', message: 'x' }),
    );
    mount(failed);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Received back' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm received back' }));
    await waitFor(() =>
      expect(mocks.receivedBack).toHaveBeenCalledWith('s2', { note: '', reship: false }),
    );
    expect(
      await screen.findByText(/Could not record the return|Already received back/),
    ).toBeInTheDocument();
  });

  it('offers no action once the parcel was received back', () => {
    mount({
      ...failed,
      status: 'returned',
      receivedBackAt: '2026-11-10T10:00:00.000Z',
    } as Shipment);
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });
});
