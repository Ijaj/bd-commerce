// UNVERIFIED: written from Steadfast's merchant API docs as remembered, not tested against their
// sandbox or production. Check the request/response shapes and status names with real keys
// before enabling this courier.
import { HttpStatus } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ShipmentError } from '../shipments.errors';
import {
  asRecord,
  type BookInput,
  type CourierAdapter,
  CourierApiError,
  type CourierMapped,
  type FetchFn,
  safeEqual,
  taka,
  type WebhookEvent,
} from './courier.types';

/** delivery_status values -> shared vocabulary. "pending" covers everything until delivery. */
export function mapSteadfastStatus(raw: string): CourierMapped | null {
  switch (raw.toLowerCase().replace(/[\s-]+/g, '_')) {
    case 'pending':
    case 'in_review':
      return 'booked';
    case 'hold':
      return 'in_transit';
    case 'delivered':
    case 'delivered_approval_pending':
      return 'delivered';
    // Part of the parcel came back and only part of the cash was collected: needs a human.
    case 'partial_delivered':
    case 'partial_delivered_approval_pending':
      return 'failed';
    case 'cancelled':
    case 'cancelled_approval_pending':
      return 'cancelled';
    default:
      return null;
  }
}

export class SteadfastCourier implements CourierAdapter {
  readonly code = 'steadfast';

  constructor(
    private readonly env: Env,
    private readonly fetchFn: FetchFn = (...a) => globalThis.fetch(...a),
  ) {}

  assertConfigured() {
    if (!this.env.STEADFAST_API_KEY || !this.env.STEADFAST_SECRET_KEY) {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'COURIER_NOT_CONFIGURED',
        'Steadfast API keys are not configured',
      );
    }
  }

  private headers() {
    return {
      'Api-Key': this.env.STEADFAST_API_KEY ?? '',
      'Secret-Key': this.env.STEADFAST_SECRET_KEY ?? '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown) {
    this.assertConfigured();
    let res: Response;
    try {
      res = await this.fetchFn(`${this.env.STEADFAST_BASE_URL}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new CourierApiError(`Steadfast unreachable: ${(e as Error).message}`);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = asRecord(json).message;
      throw new CourierApiError(
        `Steadfast HTTP ${res.status}${typeof msg === 'string' ? `: ${msg}` : ''}`,
        json,
      );
    }
    return asRecord(json);
  }

  async book(input: BookInput) {
    const invoice = input.attempt > 1 ? `${input.shipmentNo}-R${input.attempt}` : input.shipmentNo;
    const json = await this.call('POST', '/create_order', {
      invoice,
      recipient_name: input.recipient.name,
      recipient_phone: input.recipient.phone,
      recipient_address: input.recipient.address.slice(0, 250),
      cod_amount: taka(input.codAmountP),
      note: input.note ?? undefined,
      item_description: input.itemsText.slice(0, 500),
    });
    const c = asRecord(json.consignment);
    if (json.status !== 200 || c.consignment_id === undefined) {
      throw new CourierApiError(`Steadfast rejected the order: ${String(json.message)}`, json);
    }
    return {
      consignmentId: String(c.consignment_id),
      trackingUrl: c.tracking_code
        ? `https://steadfast.com.bd/t/${String(c.tracking_code)}`
        : undefined,
      raw: json,
    };
  }

  async cancel(_consignmentId: string): Promise<void> {
    // No cancel endpoint in the public merchant API: staff cancel in the Steadfast portal.
    throw new CourierApiError('Steadfast has no cancel API; cancel it in their portal');
  }

  async status(consignmentId: string) {
    const json = await this.call('GET', `/status_by_cid/${encodeURIComponent(consignmentId)}`);
    const rawStatus = String(json.delivery_status ?? 'unknown');
    return { rawStatus, mapped: mapSteadfastStatus(rawStatus), raw: json };
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>) {
    const token = this.env.STEADFAST_WEBHOOK_TOKEN;
    const auth = headers.authorization;
    return !!token && typeof auth === 'string' && safeEqual(auth, `Bearer ${token}`);
  }

  parseWebhook(body: unknown): WebhookEvent | null {
    const b = asRecord(body);
    // tracking_update notifications carry no status change.
    if (b.notification_type !== 'delivery_status' || b.consignment_id === undefined) return null;
    const rawStatus = String(b.status ?? 'unknown');
    return {
      consignmentId: String(b.consignment_id),
      rawStatus,
      mapped: mapSteadfastStatus(rawStatus),
    };
  }
}
