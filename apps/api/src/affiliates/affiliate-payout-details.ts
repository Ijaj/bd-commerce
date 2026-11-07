import { decrypt, encrypt } from '../auth/crypto';
import type { PayoutDetails } from './affiliates.schemas';

export function sealDetails(details: PayoutDetails, key: string) {
  return encrypt(JSON.stringify(details), key);
}

/** Null when nothing is saved or the sealed value cannot be read (key changed). */
export function openDetails(sealed: string | null, key: string): PayoutDetails | null {
  if (!sealed) return null;
  try {
    return JSON.parse(decrypt(sealed, key)) as PayoutDetails;
  } catch {
    return null;
  }
}

/** `01712345566` → `017•••••566`; bank → `…1234`. Customers and view-only staff only ever get this. */
export function maskDetails(d: PayoutDetails | null): string | null {
  if (!d) return null;
  if (d.method === 'bkash') return `${d.bkashNumber.slice(0, 3)}•••••${d.bkashNumber.slice(-3)}`;
  return `…${d.accountNo.slice(-4)}`;
}
