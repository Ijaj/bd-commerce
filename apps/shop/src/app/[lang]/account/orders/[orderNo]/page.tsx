import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '~/components/States';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { OrderDetailView } from '~/features/orders/OrderDetailView';
import { dict, fmt } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({
  params,
}: LangProps<{ orderNo: string }>): Promise<Metadata> {
  const { lang, orderNo } = await routeParams(params);
  return {
    title: fmt(dict(lang).orders.orderTitle, { no: orderNo }),
    alternates: alternatesFor(lang, `/account/orders/${orderNo}`),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps<{ orderNo: string }>) {
  const { lang, orderNo } = await routeParams(params);
  const d = dict(lang).orders;
  const { me, cookie } = await requireCustomer(lang, `/account/orders/${orderNo}`);
  const r = await serverApi({ cookie }).GET('/v1/customer/orders/{orderNo}', {
    params: { path: { orderNo } },
  });
  if (r.response.ok && r.data) {
    return (
      <div className="wrap page">
        <SessionSeed me={me} />
        <OrderDetailView lang={lang} o={r.data} />
      </div>
    );
  }
  const missing = r.response.status === 404;
  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <ErrorState
        lang={lang}
        title={missing ? d.notFound : undefined}
        body={missing ? d.notFoundBody : d.loadError}
        action={
          <Link className="btn btn-primary" href={href(lang, '/account/orders')}>
            {d.back}
          </Link>
        }
      />
    </div>
  );
}
