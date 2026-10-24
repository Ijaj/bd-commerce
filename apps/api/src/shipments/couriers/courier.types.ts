import { timingSafeEqual } from 'node:crypto';

/** Status vocabulary every adapter maps its courier-specific values onto. */
export type CourierMapped =
  | 'booked'
  | 'handed_over'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'returning'
  | 'returned'
  | 'cancelled';

export interface BookInput {
  shipmentNo: string;
  /** 1 for the first booking; later attempts must use a fresh courier-side invoice id. */
  attempt: number;
  recipient: {
    name: string;
    phone: string;
    /** shipLine + landmark */
    address: string;
    placeText: string;
    districtId: number;
    upazilaId: number;
    areaId?: number | null;
  };
  codAmountP: number;
  weightG: number;
  note: string | null;
  itemsText: string;
  pickup: 'warehouse' | 'supplier';
}

export interface BookResult {
  consignmentId: string;
  trackingUrl?: string;
  raw: unknown;
}

export interface StatusResult {
  rawStatus: string;
  /** null = a status we don't know yet: recorded as an event, shipment untouched. */
  mapped: CourierMapped | null;
  raw: unknown;
}

export interface WebhookEvent {
  consignmentId: string;
  rawStatus: string;
  mapped: CourierMapped | null;
}

export interface CourierAdapter {
  readonly code: string;
  /** Throws ShipmentError COURIER_NOT_CONFIGURED (409) when env keys are missing. */
  assertConfigured(): void;
  book(input: BookInput): Promise<BookResult>;
  cancel(consignmentId: string): Promise<void>;
  status(consignmentId: string): Promise<StatusResult>;
  /** Parses a webhook body; null = not a status notification (ack and ignore). */
  parseWebhook?(body: unknown): WebhookEvent | null;
  /** Checks the webhook's auth header(s). */
  verifyWebhook?(headers: Record<string, string | string[] | undefined>): boolean;
}

/** Courier answered with an error or could not be reached. `raw` is stored on the booking. */
export class CourierApiError extends Error {
  constructor(
    message: string,
    readonly raw: unknown = null,
  ) {
    super(message);
  }
}

export const taka = (paisa: number) => Math.round(paisa) / 100;

export const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export type FetchFn = typeof fetch;

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
