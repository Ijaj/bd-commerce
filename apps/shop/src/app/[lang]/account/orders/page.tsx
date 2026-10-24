import type { Metadata } from 'next';
import { ErrorState } from '~/components/States';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { OrderList } from '~/features/orders/OrderList';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).orders.listTitle,
    alternates: alternatesFor(lang, '/account/orders'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: LangProps & { searchParams: Promise<{ page?: string }> }) {
  const { lang } = await routeParams(params);
  const { page } = await searchParams;
  const d = dict(lang).orders;
  const { me, cookie } = await requireCustomer(lang, '/account/orders');
  const n = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const r = await serverApi({ cookie }).GET('/v1/customer/orders', {
    params: { query: { page: n } },
  });
  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <h1 className="page-title">{d.listTitle}</h1>
      {r.response.ok && r.data ? (
        <OrderList lang={lang} data={r.data} basePath="/account/orders" />
      ) : (
        <ErrorState lang={lang} body={d.loadError} />
      )}
    </div>
  );
}
