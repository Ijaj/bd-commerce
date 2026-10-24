// UNVERIFIED: written from Pathao Merchant (Hermes) API docs as remembered, not tested against
// their sandbox or production. Check the request/response shapes and status names with real
// credentials before enabling this courier. City/zone ids are left out on purpose: Pathao can
// parse the address, and we don't hold their city/zone tables.
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
  type WebhookEvent,
} from './courier.types';

/** Order status names (from info lookups and webhook events) -> shared vocabulary. */
export function mapPathaoStatus(raw: string): CourierMapped | null {
  // Webhook events are named order.<status>; info lookups return the bare status name.
  switch (
    raw
      .toLowerCase()
      .replace(/[\s._-]+/g, '_')
      .replace(/^order_/, '')
  ) {
    case 'pending':
    case 'created':
    case 'updated':
    case 'pickup_requested':
    case 'assigned_for_pickup':
    case 'pickup_failed':
      return 'booked';
    case 'pickup':
    case 'picked':
    case 'picked_up':
      return 'handed_over';
    case 'at_the_sorting_hub':
    case 'in_transit':
    case 'received_at_last_mile_hub':
    case 'assigned_for_delivery':
    case 'on_hold':
      return 'in_transit';
    case 'delivered':
    case 'paid':
      return 'delivered';
    // Partly delivered: cash and goods need a manual reconcile.
    case 'partial_delivery':
    case 'delivery_failed':
      return 'failed';
    case 'return':
    case 'paid_return':
      return 'returning';
    case 'returned':
      return 'returned';
    case 'pickup_cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

export class PathaoCourier implements CourierAdapter {
  readonly code = 'pathao';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly env: Env,
    private readonly fetchFn: FetchFn = (...a) => globalThis.fetch(...a),
  ) {}

  assertConfigured() {
    const e = this.env;
    if (
      !e.PATHAO_CLIENT_ID ||
      !e.PATHAO_CLIENT_SECRET ||
      !e.PATHAO_USERNAME ||
      !e.PATHAO_PASSWORD ||
      !e.PATHAO_STORE_ID
    ) {
      throw new ShipmentError(
        HttpStatus.CONFLICT,
        'COURIER_NOT_CONFIGURED',
        'Pathao credentials are not configured',
      );
    }
  }

  private async send(method: 'GET' | 'POST', path: string, body: unknown, bearer?: string) {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.env.PATHAO_BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new CourierApiError(`Pathao unreachable: ${(e as Error).message}`);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = asRecord(json).message;
      throw new CourierApiError(
        `Pathao HTTP ${res.status}${typeof msg === 'string' ? `: ${msg}` : ''}`,
        json,
      );
    }
    return asRecord(json);
  }

  private async bearer() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const json = await this.send('POST', '/aladdin/api/v1/issue-token', {
      client_id: this.env.PATHAO_CLIENT_ID,
      client_secret: this.env.PATHAO_CLIENT_SECRET,
      username: this.env.PATHAO_USERNAME,
      password: this.env.PATHAO_PASSWORD,
      grant_type: 'password',
    });
    if (typeof json.access_token !== 'string') {
      throw new CourierApiError('Pathao token request failed', json);
    }
    const ttl = typeof json.expires_in === 'number' ? json.expires_in : 3600;
    this.token = { value: json.access_token, expiresAt: Date.now() + ttl * 1000 };
    return json.access_token;
  }

  async book(input: BookInput) {
    this.assertConfigured();
    const bearer = await this.bearer();
    // Pathao wants 0.5-10 kg.
    const kg = Math.min(10, Math.max(0.5, Math.ceil(input.weightG / 100) / 10));
    const json = await this.send(
      'POST',
      '/aladdin/api/v1/orders',
      {
        store_id: Number(this.env.PATHAO_STORE_ID),
        merchant_order_id:
          input.attempt > 1 ? `${input.shipmentNo}-R${input.attempt}` : input.shipmentNo,
        recipient_name: input.recipient.name,
        recipient_phone: input.recipient.phone,
        recipient_address: input.recipient.address,
        delivery_type: 48,
        item_type: 2,
        special_instruction: input.note ?? undefined,
        item_quantity: 1,
        item_weight: kg,
        item_description: input.itemsText.slice(0, 500),
        amount_to_collect: Math.round(input.codAmountP / 100),
      },
      bearer,
    );
    const data = asRecord(json.data);
    if (data.consignment_id === undefined) {
      throw new CourierApiError(`Pathao rejected the order: ${String(json.message)}`, json);
    }
    return {
      consignmentId: String(data.consignment_id),
      trackingUrl: `https://merchant.pathao.com/tracking?consignment_id=${String(data.consignment_id)}`,
      raw: json,
    };
  }

  async cancel(_consignmentId: string): Promise<void> {
    // The merchant API has no cancel call: staff cancel in the Pathao merchant panel.
    throw new CourierApiError('Pathao has no cancel API; cancel it in their merchant panel');
  }

  async status(consignmentId: string) {
    this.assertConfigured();
    const json = await this.send(
      'GET',
      `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`,
      undefined,
      await this.bearer(),
    );
    const rawStatus = String(asRecord(json.data).order_status ?? 'unknown');
    return { rawStatus, mapped: mapPathaoStatus(rawStatus), raw: json };
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>) {
    const secret = this.env.PATHAO_WEBHOOK_SECRET;
    const sig = headers['x-pathao-signature'];
    return !!secret && typeof sig === 'string' && safeEqual(sig, secret);
  }

  parseWebhook(body: unknown): WebhookEvent | null {
    const b = asRecord(body);
    if (b.consignment_id === undefined) return null; // e.g. the integration test ping
    const rawStatus = String(b.order_status ?? b.event ?? 'unknown');
    return {
      consignmentId: String(b.consignment_id),
      rawStatus,
      mapped:
        mapPathaoStatus(typeof b.event === 'string' ? b.event : rawStatus) ??
        mapPathaoStatus(rawStatus),
    };
  }
}
