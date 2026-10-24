import type { Metadata } from 'next';
import Link from 'next/link';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { AddressesManager } from '~/features/orders/AddressesManager';
import { dict } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).orders.addrTitle,
    alternates: alternatesFor(lang, '/account/addresses'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const d = dict(lang).orders;
  const { me, cookie } = await requireCustomer(lang, '/account/addresses');
  const r = await serverApi({ cookie }).GET('/v1/customer/addresses');
  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <h1 className="page-title">{d.addrTitle}</h1>
      <AddressesManager
        lang={lang}
        initial={r.response.ok && r.data ? r.data : []}
        customerName={me.name}
        customerPhone={me.phone ?? ''}
      />
      <p style={{ marginTop: 'var(--s4)' }}>
        <Link className="link" href={href(lang, '/account')}>
          {d.addrBack}
        </Link>
      </p>
    </div>
  );
}
