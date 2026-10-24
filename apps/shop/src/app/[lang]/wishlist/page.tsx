import type { Metadata } from 'next';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { WishlistGrid } from '~/features/account/WishlistGrid';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { ApiHttpError, serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';
import type { ProductCard } from '~/lib/types';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).account.wishlistTitle,
    alternates: alternatesFor(lang, '/wishlist'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const { me, cookie } = await requireCustomer(lang, '/wishlist');
  const r = await serverApi({ cookie }).GET('/v1/customer/wishlist');
  if (!r.response.ok || !r.data) throw new ApiHttpError(r.response.status, r.error);
  const items: ProductCard[] = r.data.items;

  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <h1 className="page-title">{dict(lang).account.wishlistTitle}</h1>
      <WishlistGrid lang={lang} items={items} />
    </div>
  );
}
