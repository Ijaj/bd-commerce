import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '~/components/States';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { canRequestReturn } from '~/features/returns/logic';
import { ReturnForm } from '~/features/returns/ReturnForm';
import type { OrderForReturn } from '~/features/returns/types';
import { dict, fmt } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).returns.formTitle,
    alternates: alternatesFor(lang, '/account/returns/new'),
    robots: { index: false, follow: false },
  };
}

/** `/account/returns/new?order=<orderNo>`: the order is read server-side, the API re-checks eligibility on submit. */
export default async function Page({
  params,
  searchParams,
}: LangProps & { searchParams: Promise<{ order?: string }> }) {
  const { lang } = await routeParams(params);
  const { order } = await searchParams;
  const d = dict(lang).returns;
  const orderNo = (order ?? '').trim();
  const { me, cookie } = await requireCustomer(
    lang,
    `/account/returns/new?order=${encodeURIComponent(orderNo)}`,
  );
  const r = orderNo
    ? await serverApi({ cookie }).GET('/v1/customer/orders/{orderNo}', {
        params: { path: { orderNo } },
      })
    : null;
  const o = r?.response.ok && r.data ? (r.data as OrderForReturn) : null;
  const back = (
    <Link className="btn btn-primary" href={href(lang, '/account/orders')}>
      {d.viewOrders}
    </Link>
  );
  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <h1 className="page-title">{d.formTitle}</h1>
      {!o ? (
        <ErrorState
          lang={lang}
          title={dict(lang).orders.notFound}
          body={dict(lang).orders.notFoundBody}
          action={back}
        />
      ) : !canRequestReturn(o) ? (
        <ErrorState
          lang={lang}
          title={fmt(dict(lang).orders.orderTitle, { no: o.orderNo })}
          body={
            o.status === 'delivered' || o.status === 'completed'
              ? d.nothingReturnable
              : d.notDelivered
          }
          action={back}
        />
      ) : (
        <ReturnForm lang={lang} order={o} />
      )}
    </div>
  );
}
