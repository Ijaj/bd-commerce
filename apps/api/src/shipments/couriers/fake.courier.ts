import { type CourierAdapter, CourierApiError, type CourierMapped } from './courier.types';

/**
 * Deterministic in-memory courier for dev and tests. State lives at module level so tests can
 * drive it: `fakeCourierHooks.setStatus(id, 'delivered')`, `failNextBook('boom')`, `reset()`.
 */
const state = {
  statuses: new Map<string, CourierMapped>(),
  cancelled: new Set<string>(),
  booked: [] as { consignmentId: string; shipmentNo: string; codAmountP: number }[],
  failNext: null as string | null,
};

export const fakeCourierHooks = {
  setStatus(consignmentId: string, mapped: CourierMapped) {
    state.statuses.set(consignmentId, mapped);
  },
  failNextBook(message = 'Fake courier is down') {
    state.failNext = message;
  },
  get booked() {
    return state.booked;
  },
  get cancelled() {
    return state.cancelled;
  },
  reset() {
    state.statuses.clear();
    state.cancelled.clear();
    state.booked = [];
    state.failNext = null;
  },
};

export class FakeCourier implements CourierAdapter {
  readonly code = 'fake';

  assertConfigured() {}

  async book(input: Parameters<CourierAdapter['book']>[0]) {
    if (state.failNext) {
      const message = state.failNext;
      state.failNext = null;
      throw new CourierApiError(message, { error: message });
    }
    const consignmentId =
      input.attempt > 1 ? `FAKE-${input.shipmentNo}-${input.attempt}` : `FAKE-${input.shipmentNo}`;
    state.statuses.set(consignmentId, 'booked');
    state.booked.push({
      consignmentId,
      shipmentNo: input.shipmentNo,
      codAmountP: input.codAmountP,
    });
    return {
      consignmentId,
      trackingUrl: `https://fake-courier.test/track/${consignmentId}`,
      raw: { consignmentId, accepted: true },
    };
  }

  async cancel(consignmentId: string) {
    state.cancelled.add(consignmentId);
    state.statuses.set(consignmentId, 'cancelled');
  }

  async status(consignmentId: string) {
    const mapped = state.statuses.get(consignmentId) ?? 'booked';
    return { rawStatus: mapped, mapped, raw: { status: mapped } };
  }
}
