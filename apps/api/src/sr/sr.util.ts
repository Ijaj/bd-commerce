import { BadRequestException, type HttpException } from '@nestjs/common';

const DHAKA_OFFSET_MS = 6 * 3_600_000; // Bangladesh has no DST

/** Domain error with a stable `code` the portal can switch on. */
export function srError(Exc: new (body: object) => HttpException, code: string, message: string) {
  return new Exc({ message, code });
}

/** `YYYY-MM` of an instant in Dhaka time. */
export function monthKey(at: Date): string {
  const d = new Date(at.getTime() + DHAKA_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** `[start, end)` instants of a Dhaka calendar month. */
export function monthRange(month: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new BadRequestException('month must be YYYY-MM');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return {
    start: new Date(Date.UTC(y, mo - 1, 1) - DHAKA_OFFSET_MS),
    end: new Date(Date.UTC(y, mo, 1) - DHAKA_OFFSET_MS),
  };
}

/** `SR-YYMM-NNNNN`, YYMM in Dhaka time (C32). */
export function memoNumber(at: Date, seq: bigint | number): string {
  const key = monthKey(at);
  return `SR-${key.slice(2, 4)}${key.slice(5, 7)}-${String(seq).padStart(5, '0')}`;
}

/** Commission in paisa, rounded down. */
export function commissionOf(baseP: number, bp: number): number {
  return Math.floor((baseP * bp) / 10_000);
}

export const MAX_MONEY_P = 2_000_000_000; // keep sums inside Postgres int4
