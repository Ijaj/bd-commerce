import { createHmac } from 'node:crypto';
import type { Env } from '../config/env';

export interface ImgproxyConfig {
  url: string;
  key: string;
  salt: string;
  bucket: string;
}

export function imgproxyConfig(env: Env): ImgproxyConfig {
  return {
    url: env.IMGPROXY_URL,
    key: env.IMGPROXY_KEY,
    salt: env.IMGPROXY_SALT,
    bucket: env.S3_BUCKET_PRODUCTS,
  };
}

export interface ImgproxyOptions {
  width?: number;
  height?: number;
  /// fit = keep aspect inside the box, fill = crop to the box
  resize?: 'fit' | 'fill';
  format?: 'webp' | 'avif' | 'jpg' | 'png';
}

/** Signed imgproxy URL for an object in Garage (`s3://bucket/key`). Defaults: fit, webp. */
export function imgproxyUrl(cfg: ImgproxyConfig, storageKey: string, opts: ImgproxyOptions = {}) {
  const { width = 0, height = 0, resize = 'fit', format = 'webp' } = opts;
  const source = Buffer.from(`s3://${cfg.bucket}/${storageKey}`).toString('base64url');
  const path = `/rs:${resize}:${width}:${height}/${source}.${format}`;
  const signature = createHmac('sha256', Buffer.from(cfg.key, 'hex'))
    .update(Buffer.from(cfg.salt, 'hex'))
    .update(path)
    .digest('base64url');
  return `${cfg.url.replace(/\/$/, '')}/${signature}${path}`;
}
