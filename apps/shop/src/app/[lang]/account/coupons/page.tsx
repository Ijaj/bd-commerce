import type { Metadata } from 'next';
import { ErrorState } from '~/components/States';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { WalletList } from '~/features/promotions/WalletList';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).promos.wallet.title,
    alternates: alternatesFor(lang, '/account/coupons'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const t = dict(lang).promos.wallet;
  const { me, cookie } = await requireCustomer(lang, '/account/coupons');
  const r = await serverApi({ cookie }).GET('/v1/customer/coupons');
  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <h1 className="page-title">{t.title}</h1>
      {r.response.ok && r.data ? (
        <>
          <p>{t.intro}</p>
          <WalletList lang={lang} initial={r.data.items} />
        </>
      ) : (
        <ErrorState lang={lang} body={t.loadError} />
      )}
    </div>
  );
}
