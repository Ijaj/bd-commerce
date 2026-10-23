import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// Argon2id (C15), OWASP baseline: 19 MiB memory, 2 iterations.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword(hashed: string, password: string): Promise<boolean> {
  return verify(hashed, password).catch(() => false);
}

/** Used when the email is unknown, so response time doesn't reveal which emails exist. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(await dummyHash, password);
}

export function newTempPassword(): string {
  return randomBytes(12).toString('base64url');
}

export const MIN_PASSWORD_LENGTH = 12;
