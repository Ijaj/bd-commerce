import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '~/components/States';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { ReturnDetailView } from '~/features/returns/ReturnDetailView';
import { dict, fmt } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({
  params,
}: LangProps<{ returnNo: string }>): Promise<Metadata> {
  const { lang, returnNo } = await routeParams(params);
  return {
    title: fmt(dict(lang).returns.returnTitle, { no: returnNo }),
    alternates: alternatesFor(lang, `/account/returns/${returnNo}`),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps<{ returnNo: string }>) {
  const { lang, returnNo } = await routeParams(params);
  const d = dict(lang).returns;
  const { me, cookie } = await requireCustomer(lang, `/account/returns/${returnNo}`);
  const r = await serverApi({ cookie }).GET('/v1/customer/returns/{returnNo}', {
    params: { path: { returnNo } },
  });
  if (r.response.ok && r.data) {
    return (
      <div className="wrap page">
        <SessionSeed me={me} />
        <ReturnDetailView lang={lang} r={r.data} />
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
          <Link className="btn btn-primary" href={href(lang, '/account/returns')}>
            {d.back}
          </Link>
        }
      />
    </div>
  );
}
