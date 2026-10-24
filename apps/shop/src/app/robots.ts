import type { MetadataRoute } from 'next';
import { SITE_URL } from '~/lib/env';

// Customer-specific and thin pages must not be indexed; same for the /bn mirror. Filtered
// listing URLs are also marked noindex in their metadata, the patterns just save crawl budget.
const PRIVATE = [
  '/account',
  '/cart',
  '/checkout',
  '/login',
  '/signup',
  '/reset',
  '/wishlist',
  '/track',
  '/search',
];
const FILTERS = ['sort', 'min', 'max', 'brand', 'availability', 'rating', 'attr.'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          ...PRIVATE,
          ...PRIVATE.map((p) => `/bn${p}`),
          ...FILTERS.map((f) => `/*?*${f}=`),
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
