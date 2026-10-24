import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  freeAboveFrom,
  freeLabel,
  freeModeOf,
  type ZoneFormValues,
  zoneBody,
} from '~/features/delivery/logic';
import { theme } from '~/theme';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  addLocation: vi.fn(),
  removeLocation: vi.fn(),
  divisions: vi.fn(),
  districts: vi.fn(),
  upazilas: vi.fn(),
}));

vi.mock('~/features/delivery/api', () => ({ deliveryApi: mocks }));
vi.mock('~/lib/perm', () => ({ useCan: () => true }));

import { DeliveryPage } from '~/features/delivery/DeliveryPage';
import { ZoneModal } from '~/features/delivery/ZoneModal';

const zone = (over: Record<string, unknown>) => ({
  id: 'z1',
  nameEn: 'Inside Dhaka',
  nameBn: null,
  baseChargeP: 6000,
  baseWeightG: 1000,
  extraPerKgP: 2000,
  etaMinDays: 1,
  etaMaxDays: 2,
  freeAboveP: null,
  isDefault: false,
  sort: 0,
  orderCount: 0,
  createdAt: '',
  updatedAt: '',
  locations: [],
  ...over,
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider theme={theme} env="test">
        {ui}
      </MantineProvider>
    </QueryClientProvider>,
  );
}

const values = (over: Partial<ZoneFormValues> = {}): ZoneFormValues => ({
  nameEn: ' Zone ',
  nameBn: '',
  baseChargeP: 6000,
  baseWeightKg: 1.5,
  extraPerKgP: 2000,
  etaMinDays: 1,
  etaMaxDays: 3,
  freeMode: 'never',
  freeAmountP: null,
  isDefault: false,
  ...over,
});

describe('free delivery semantics (Q105)', () => {
  it('maps null / 0 / amount to the three modes', () => {
    expect(freeModeOf(null)).toBe('never');
    expect(freeModeOf(0)).toBe('always');
    expect(freeModeOf(200000)).toBe('above');
  });

  it('converts a mode back to the API value', () => {
    expect(freeAboveFrom('never', 5000)).toEqual({ value: null });
    expect(freeAboveFrom('always', 5000)).toEqual({ value: 0 });
    expect(freeAboveFrom('above', 200000)).toEqual({ value: 200000 });
    expect(freeAboveFrom('above', null)).toHaveProperty('error');
    expect(freeAboveFrom('above', 0)).toHaveProperty('error');
  });

  it('labels each case', () => {
    const fmt = (p: number) => `৳${p / 100}`;
    expect(freeLabel(null, fmt)).toBe('Never free');
    expect(freeLabel(0, fmt)).toBe('Always free');
    expect(freeLabel(200000, fmt)).toBe('Above ৳2000');
  });

  it('builds the body with kg -> grams and blanks as null', () => {
    expect(zoneBody(values())).toMatchObject({
      nameEn: 'Zone',
      nameBn: null,
      baseWeightG: 1500,
      freeAboveP: null,
    });
    expect(zoneBody(values({ freeMode: 'always' })).freeAboveP).toBe(0);
    expect(zoneBody(values({ freeMode: 'above', freeAmountP: 150000 })).freeAboveP).toBe(150000);
  });
});

describe('ZoneModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
  });

  it('refuses "free above" without an amount', async () => {
    wrap(<ZoneModal zone={null} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Name \(English\)/), {
      target: { value: 'Outside Dhaka' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Base charge/), { target: { value: '120' } });
    fireEvent.click(within(dialog).getByText('Free above an amount'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add zone' }));
    expect(await within(dialog).findByText('Enter an amount above zero')).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('saves "always free" as 0 and "never" as null', async () => {
    wrap(<ZoneModal zone={null} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Name \(English\)/), {
      target: { value: 'Pickup' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Base charge/), { target: { value: '60' } });
    fireEvent.click(within(dialog).getByText('Always free'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add zone' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ nameEn: 'Pickup', baseChargeP: 6000, freeAboveP: 0 }),
      ),
    );
  });

  it('keeps an existing free-above amount when editing', async () => {
    wrap(<ZoneModal zone={zone({ freeAboveP: 300000 }) as never} onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Free when subtotal reaches/)).toHaveValue('৳3,000.00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        'z1',
        expect.objectContaining({ freeAboveP: 300000 }),
      ),
    );
  });
});

describe('DeliveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([
      zone({ id: 'z1', nameEn: 'Inside Dhaka', freeAboveP: 200000 }),
      zone({ id: 'z2', nameEn: 'Outside Dhaka', isDefault: true, freeAboveP: 0 }),
    ]);
  });

  it('shows charges, free rule and default flag', async () => {
    wrap(<DeliveryPage />);
    expect(await screen.findByText('Inside Dhaka')).toBeInTheDocument();
    expect(screen.getByText('Above ৳2,000')).toBeInTheDocument();
    expect(screen.getByText('Always free')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('asks before deleting', async () => {
    wrap(<DeliveryPage />);
    await screen.findByText('Inside Dhaka');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Inside Dhaka' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete zone', { selector: 'h2, div' })).toBeInTheDocument();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
