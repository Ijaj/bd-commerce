import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '~/components/States';
import { requireCustomer } from '~/features/account/server';
import { InvoiceView } from '~/features/returns/InvoiceView';
import { dict, fmt } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({
  params,
}: LangProps<{ orderNo: string }>): Promise<Metadata> {
  const { lang, orderNo } = await routeParams(params);
  return {
    title: fmt(dict(lang).returns.inv.title, { no: orderNo }),
    alternates: alternatesFor(lang, `/order/${orderNo}/invoice`),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps<{ orderNo: string }>) {
  const { lang, orderNo } = await routeParams(params);
  const d = dict(lang).returns.inv;
  const { cookie } = await requireCustomer(lang, `/order/${orderNo}/invoice`);
  const r = await serverApi({ cookie }).GET('/v1/customer/orders/{orderNo}/invoice', {
    params: { path: { orderNo } },
  });
  if (r.response.ok && r.data) {
    return (
      <div className="wrap page">
        <InvoiceView lang={lang} inv={r.data} />
      </div>
    );
  }
  const notReady = r.response.status === 409 || r.response.status === 404;
  return (
    <div className="wrap page">
      <ErrorState
        lang={lang}
        title={notReady ? d.notAvailable : undefined}
        body={notReady ? d.notAvailableBody : d.loadError}
        action={
          <Link className="btn btn-primary" href={href(lang, `/account/orders/${orderNo}`)}>
            {d.back}
          </Link>
        }
      />
    </div>
  );
}
