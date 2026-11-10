import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  freeQuantities,
  needsManualCancel,
  needsReceiveBack,
  parseIds,
} from '~/features/shipments/logic';

describe('allowedActions', () => {
  it('offers book on ready and handover on booked only', () => {
    expect(allowedActions('ready')).toContain('book');
    expect(allowedActions('ready')).not.toContain('handover');
    expect(allowedActions('booked')).toContain('handover');
    expect(allowedActions('booked')).not.toContain('book');
  });
  it('offers nothing once delivered or cancelled', () => {
    expect(allowedActions('delivered')).toEqual([]);
    expect(allowedActions('cancelled')).toEqual([]);
  });
  it('cannot cancel after handover', () => {
    expect(allowedActions('handed_over')).not.toContain('cancel');
    expect(allowedActions('in_transit')).toContain('sync');
  });
});

describe('freeQuantities', () => {
  const lines = [
    { id: 'a', qty: 5, qtyCancelled: 1 },
    { id: 'b', qty: 2, qtyCancelled: 0 },
  ];
  it('subtracts live shipments and ignores cancelled ones', () => {
    const free = freeQuantities(lines, [
      { status: 'ready', items: [{ orderItemId: 'a', qty: 3 }] as never },
      { status: 'cancelled', items: [{ orderItemId: 'b', qty: 2 }] as never },
    ]);
    expect(free.get('a')).toBe(1);
    expect(free.get('b')).toBe(2);
  });
  it('never goes negative', () => {
    const free = freeQuantities(lines, [
      { status: 'booked', items: [{ orderItemId: 'a', qty: 9 }] as never },
    ]);
    expect(free.get('a')).toBe(0);
  });
});

describe('helpers', () => {
  it('parses and de-duplicates ids', () => {
    expect(parseIds(' a, b ,a,,c')).toEqual(['a', 'b', 'c']);
    expect(parseIds(undefined)).toEqual([]);
  });
  it('detects the courier cancel failure code', () => {
    expect(needsManualCancel('COURIER_CANCEL_FAILED')).toBe(true);
    expect(needsManualCancel(null)).toBe(false);
  });
});

describe('received back (C87)', () => {
  it('flags failed, returning and returned parcels until they are taken back', () => {
    for (const status of ['failed', 'returning', 'returned'] as const) {
      expect(needsReceiveBack({ status, receivedBackAt: null })).toBe(true);
      expect(needsReceiveBack({ status, receivedBackAt: '2026-11-10T10:00:00.000Z' })).toBe(false);
    }
    expect(needsReceiveBack({ status: 'delivered', receivedBackAt: null })).toBe(false);
    expect(needsReceiveBack({ status: 'in_transit', receivedBackAt: null })).toBe(false);
  });

  it('does not count received-back goods against the free quantity', () => {
    const free = freeQuantities(
      [{ id: 'a', qty: 2, qtyCancelled: 0 }],
      [
        {
          status: 'returned',
          receivedBackAt: '2026-11-10T10:00:00.000Z',
          items: [{ orderItemId: 'a', qty: 2 }] as never,
        },
      ],
    );
    expect(free.get('a')).toBe(2);
  });
});
