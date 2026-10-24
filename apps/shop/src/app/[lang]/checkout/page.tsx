import type { Metadata } from 'next';
import { getCustomer, sessionCookie } from '~/features/account/server';
import { cartCookie, getCart } from '~/features/cart/server';
import { CheckoutForm } from '~/features/checkout/CheckoutForm';
import type { Address } from '~/features/checkout/types';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).checkout.title,
    alternates: alternatesFor(lang, '/checkout'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const [cookie, session] = await Promise.all([cartCookie(), sessionCookie()]);
  const [cart, me] = await Promise.all([getCart(cookie), getCustomer()]);
  let addresses: Address[] = [];
  if (me && session) {
    const r = await serverApi({ cookie: session }).GET('/v1/customer/addresses');
    if (r.response.ok && r.data) addresses = r.data;
  }
  return <CheckoutForm lang={lang} initialCart={cart} me={me} addresses={addresses} />;
}
