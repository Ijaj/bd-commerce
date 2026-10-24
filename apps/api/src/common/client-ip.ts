import { isIP } from 'node:net';
import type { Request } from 'express';

/** Loopback or private-network peers: where a local reverse proxy / tunnel connects from. */
function isLocalPeer(address: string | undefined): boolean {
  if (!address) return false;
  const a = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (a === '::1' || a.startsWith('127.')) return true;
  if (a.startsWith('10.') || a.startsWith('192.168.')) return true;
  const m = /^172\.(\d+)\./.exec(a);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(a);
}

/**
 * The client's IP for throttling and audit. `cf-connecting-ip` is honoured only when the API is
 * deployed behind the Cloudflare Tunnel (TRUST_CF_HEADER=1) AND the connection comes from the local
 * tunnel daemon, so a direct caller cannot spoof it. Otherwise Express's `req.ip` applies, which
 * follows `trust proxy` (TRUST_PROXY).
 */
export function clientIp(req: Request): string | undefined {
  if (process.env.TRUST_CF_HEADER === '1' && isLocalPeer(req.socket?.remoteAddress)) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && isIP(cf.trim())) return cf.trim();
  }
  return req.ip;
}

/** Parses TRUST_PROXY for Express: "false", "true", a hop count, or a subnet list. */
export function parseTrustProxy(value: string): boolean | number | string {
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'false' || v === '0') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return value.trim();
}
