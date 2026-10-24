import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { ApiHttpError, serverApi } from '~/lib/api';
import type { Me } from '~/lib/types';

/** Raw Cookie header holding only the customer session; undefined when there is none. */
export async function sessionCookie(): Promise<string | undefined> {
  const c = (await cookies()).get('bdc_cs');
  return c ? `bdc_cs=${c.value}` : undefined;
}

/** Current customer from the forwarded session cookie, or null when logged out / expired. */
export async function getCustomer(): Promise<Me | null> {
  const cookie = await sessionCookie();
  if (!cookie) return null;
  const r = await serverApi({ cookie }).GET('/v1/customer/me');
  if (r.response.status === 401) return null;
  if (!r.response.ok || !r.data) throw new ApiHttpError(r.response.status, r.error);
  return r.data as Me;
}

/**
 * For account pages: the customer, or a redirect to /login?next=<path>.
 * `path` is language-less (`/account`); the redirect keeps the visitor's language.
 */
export async function requireCustomer(
  lang: Lang,
  path: string,
): Promise<{ me: Me; cookie: string }> {
  const me = await getCustomer();
  const cookie = await sessionCookie();
  if (!me || !cookie) {
    redirect(`${href(lang, '/login')}?next=${encodeURIComponent(href(lang, path))}`);
  }
  return { me, cookie };
}
