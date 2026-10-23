import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Opaque random token for cookies; only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** e.g. "k7m2-x9pq": 8 chars from a 31-char alphabet (~40 bits), single use, rate limited. */
export function newBackupCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export function normalizeBackupCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(.{4})/, '$1-');
}

/** AES-256-GCM; output = iv.tag.ciphertext (base64url). */
export function encrypt(plain: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(sealed: string, hexKey: string): string {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
