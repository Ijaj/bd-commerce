import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { ENV, type Env } from '../config/env';
import { REDIS } from '../redis/redis.module';
import { ReturnsCompletionService } from '../returns/returns-completion.service';
import { ShipmentSyncService } from '../shipments/shipment-sync.service';

interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

/**
 * In-app scheduler (C55). Each tick takes a Redis lock first, so with several API instances only one
 * runs a job per interval. Off in tests and for the CLI (SCHEDULER=0); the CLI commands stay usable by hand.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SchedulerService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly shipments: ShipmentSyncService,
    private readonly completion: ReturnsCompletionService,
  ) {}

  private jobs(): Job[] {
    return [
      {
        name: 'sync-couriers',
        everyMs: this.env.SCHEDULER_SYNC_COURIERS_MIN * 60_000,
        run: () => this.shipments.syncOpen(),
      },
      {
        name: 'complete-orders',
        everyMs: this.env.SCHEDULER_COMPLETE_ORDERS_MIN * 60_000,
        run: () => this.completion.completeDue(),
      },
    ];
  }

  onModuleInit() {
    const enabled = this.env.SCHEDULER ? this.env.SCHEDULER === '1' : this.env.NODE_ENV !== 'test';
    if (!enabled) return;
    for (const job of this.jobs()) {
      const timer = setInterval(() => void this.tick(job), job.everyMs);
      timer.unref();
      this.timers.push(timer);
    }
    this.log.log(
      `scheduler on: ${this.jobs()
        .map((j) => j.name)
        .join(', ')}`,
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearInterval(t);
  }

  /** Runs one job now unless another instance holds its lock. Public for tests. */
  async tick(job: Job) {
    // Lock slightly shorter than the interval so a slow tick never skips the next one entirely.
    const ttl = Math.max(Math.floor(job.everyMs * 0.8), 1000);
    const got = await this.redis.set(`lock:job:${job.name}`, '1', 'PX', ttl, 'NX');
    if (got !== 'OK') return false;
    try {
      const out = await job.run();
      this.log.log(`${job.name}: ${JSON.stringify(out)}`);
    } catch (err) {
      this.log.error(`${job.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return true;
  }
}
