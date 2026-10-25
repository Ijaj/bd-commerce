import type { Metadata } from 'next';
import { ErrorState } from '~/components/States';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { ReturnList } from '~/features/returns/ReturnList';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).returns.listTitle,
    alternates: alternatesFor(lang, '/account/returns'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: LangProps & { searchParams: Promise<{ page?: string }> }) {
  const { lang } = await routeParams(params);
  const { page } = await searchParams;
  const d = dict(lang).returns;
  const { me, cookie } = await requireCustomer(lang, '/account/returns');
  const n = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const r = await serverApi({ cookie }).GET('/v1/customer/returns', {
    params: { query: { page: n } },
  });
  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <h1 className="page-title">{d.listTitle}</h1>
      {r.response.ok && r.data ? (
        <ReturnList lang={lang} data={r.data} />
      ) : (
        <ErrorState lang={lang} body={d.loadError} />
      )}
    </div>
  );
}
