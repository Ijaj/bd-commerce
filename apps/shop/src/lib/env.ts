/** Public origin of the shop, no trailing slash. */
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3100').replace(/\/$/, '');
