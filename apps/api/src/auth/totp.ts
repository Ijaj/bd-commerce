import { Secret, TOTP } from 'otpauth';

const ISSUER = 'bd-commerce';
const PERIOD = 30;

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, label: string): string {
  return new TOTP({ issuer: ISSUER, label, secret: Secret.fromBase32(secret) }).toString();
}

/**
 * Checks a 6-digit code with ±1 step drift. Returns the matched time step, or null.
 * Caller rejects steps <= the last accepted one (replay guard).
 */
export function matchTotp(secret: string, code: string, now = Date.now()): number | null {
  const totp = new TOTP({ issuer: ISSUER, secret: Secret.fromBase32(secret), period: PERIOD });
  const delta = totp.validate({ token: code.replace(/\s/g, ''), timestamp: now, window: 1 });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD) + delta;
}
