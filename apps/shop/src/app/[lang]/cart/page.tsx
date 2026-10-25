import type { Metadata } from 'next';
import { type CartNotice, CartView } from '~/features/cart/CartView';
import { cartCookie, getCart } from '~/features/cart/server';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).pages.cart,
    alternates: alternatesFor(lang, '/cart'),
    robots: { index: false, follow: false },
  };
}

const NOTICES: CartNotice[] = [
  'changed',
  'stock',
  'empty',
  'flash',
  'flash_sold',
  'coupon',
  'coupon_limit',
];

export default async function Page({
  params,
  searchParams,
}: LangProps & { searchParams: Promise<{ notice?: string }> }) {
  const { lang } = await routeParams(params);
  const { notice } = await searchParams;
  const cart = await getCart(await cartCookie());
  return <CartView lang={lang} initial={cart} notice={NOTICES.find((n) => n === notice)} />;
}
