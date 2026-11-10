import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

// Dev only: hosts (no port) a phone on the LAN opens the shop from, e.g. DEV_LAN_ORIGINS=192.168.0.23,mypc.local
const devLanOrigins = (process.env.DEV_LAN_ORIGINS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const config: NextConfig = {
  reactStrictMode: true,
  ...(devLanOrigins.length > 0 ? { allowedDevOrigins: devLanOrigins } : {}),
  agentRules: false,
  poweredByHeader: false,
  // @bdc/* workspace packages ship TS source (api-client) or ESM dist (i18n).
  transpilePackages: ['@bdc/api-client'],
  // The API serves imgproxy URLs as-is (already WebP, signed), so next/image is not used.
  images: { unoptimized: true },
  // Same-origin API for client components: the httpOnly bdc_cs cookie then works without CORS.
  // Only the customer-facing API goes through the shop origin; /v1/admin and /v1/portal stay off it
  // so a shop-side XSS can't reach staff endpoints (security review L1).
  async rewrites() {
    return ['customer', 'cart', 'checkout', 'public'].map((area) => ({
      source: `/v1/${area}/:path*`,
      destination: `${API_URL}/v1/${area}/:path*`,
    }));
  },
  // PWA (C28): the worker must never be served stale, or fixes cannot reach installed shops.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
};

export default config;
