import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/config/env';
import type { ReturnsCompletionService } from '../src/returns/returns-completion.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import type { ShipmentSyncService } from '../src/shipments/shipment-sync.service';

function make(set: ReturnType<typeof vi.fn>) {
  const syncOpen = vi.fn().mockResolvedValue({ checked: 0 });
  const completeDue = vi.fn().mockResolvedValue(0);
  const svc = new SchedulerService(
    { NODE_ENV: 'test', SCHEDULER_SYNC_COURIERS_MIN: 10, SCHEDULER_COMPLETE_ORDERS_MIN: 60 } as Env,
    { set } as unknown as Redis,
    { syncOpen } as unknown as ShipmentSyncService,
    { completeDue } as unknown as ReturnsCompletionService,
  );
  return { svc, syncOpen };
}

describe('SchedulerService', () => {
  it('runs a job only when it wins the Redis lock', async () => {
    const set = vi.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const { svc, syncOpen } = make(set);
    const job = { name: 'sync-couriers', everyMs: 600_000, run: () => syncOpen() };
    expect(await svc.tick(job)).toBe(true);
    expect(await svc.tick(job)).toBe(false);
    expect(syncOpen).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('lock:job:sync-couriers', '1', 'PX', 480_000, 'NX');
  });

  it('swallows a failing job so the timer keeps going', async () => {
    const { svc } = make(vi.fn().mockResolvedValue('OK'));
    const run = vi.fn().mockRejectedValue(new Error('courier down'));
    await expect(svc.tick({ name: 'x', everyMs: 60_000, run })).resolves.toBe(true);
  });

  it('stays off under NODE_ENV=test', () => {
    const { svc } = make(vi.fn());
    svc.onModuleInit();
    expect((svc as unknown as { timers: unknown[] }).timers).toHaveLength(0);
  });
});
