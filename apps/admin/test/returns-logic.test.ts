import { describe, expect, it } from 'vitest';
import {
  inspectDefaults,
  restockAllowed,
  returnActions,
  returnableQty,
  stepStates,
} from '~/features/returns/logic';

describe('return logic', () => {
  it('marks progress along the happy path', () => {
    const s = stepStates('received');
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
  });

  it('shows a short path for rejected returns', () => {
    expect(stepStates('rejected')).toEqual([
      { step: 'requested', state: 'done' },
      { step: 'rejected', state: 'current' },
    ]);
  });

  it('offers only the actions the status allows', () => {
    expect(returnActions('requested')).toMatchObject({
      approve: true,
      reject: true,
      receive: false,
    });
    expect(returnActions('approved')).toMatchObject({
      pickupBooked: true,
      receive: true,
      inspect: false,
    });
    expect(returnActions('received')).toMatchObject({ inspect: true, refund: false });
    expect(returnActions('inspected')).toMatchObject({ close: true, refund: true });
    expect(returnActions('closed')).toMatchObject({ close: false, refund: true, reject: false });
    expect(returnActions('rejected')).toMatchObject({ approve: false, refund: false });
  });

  it('counts returnable units and never goes negative', () => {
    expect(returnableQty({ qtyShipped: 3, qtyReturned: 1 })).toBe(2);
    expect(returnableQty({ qtyShipped: 1, qtyReturned: 2 })).toBe(0);
  });

  it('defaults inspection to resellable + restock; damaged cannot restock', () => {
    expect(inspectDefaults([{ id: 'a' }])).toEqual({
      a: { condition: 'resellable', restock: true },
    });
    expect(restockAllowed('damaged')).toBe(false);
    expect(restockAllowed('resellable')).toBe(true);
  });
});
