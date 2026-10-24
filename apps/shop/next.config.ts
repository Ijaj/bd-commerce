import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  poweredByHeader: false,
  // @bdc/* workspace packages ship TS source (api-client) or ESM dist (i18n).
  transpilePackages: ['@bdc/api-client'],
  // The API serves imgproxy URLs as-is (already WebP, signed), so next/image is not used.
  images: { unoptimized: true },
  // Same-origin API for client components: the httpOnly bdc_cs cookie then works without CORS.
  async rewrites() {
    return [{ source: '/v1/:path*', destination: `${API_URL}/v1/:path*` }];
  },
};

export default config;
