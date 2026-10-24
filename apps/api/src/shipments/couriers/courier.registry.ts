import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { ShipmentError } from '../shipments.errors';
import type { CourierAdapter, FetchFn } from './courier.types';
import { FakeCourier } from './fake.courier';
import { PathaoCourier } from './pathao.courier';
import { SteadfastCourier } from './steadfast.courier';

@Injectable()
export class CourierRegistry {
  private readonly adapters: Map<string, CourierAdapter>;

  constructor(@Inject(ENV) env: Env) {
    // Resolve fetch at call time so tests can stub globalThis.fetch.
    const fetchFn: FetchFn = (...a) => globalThis.fetch(...a);
    this.adapters = new Map<string, CourierAdapter>(
      [new FakeCourier(), new SteadfastCourier(env, fetchFn), new PathaoCourier(env, fetchFn)].map(
        (a) => [a.code, a],
      ),
    );
  }

  get(code: string): CourierAdapter {
    const a = this.adapters.get(code);
    if (!a) {
      throw new ShipmentError(HttpStatus.NOT_FOUND, 'COURIER_NOT_FOUND', 'Unknown courier');
    }
    return a;
  }
}
