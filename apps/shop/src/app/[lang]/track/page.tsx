import type { Metadata } from 'next';
import { getCustomer } from '~/features/account/server';
import { TrackForm } from '~/features/orders/TrackForm';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).orders.trackTitle,
    alternates: alternatesFor(lang, '/track'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: LangProps & { searchParams: Promise<{ order?: string }> }) {
  const { lang } = await routeParams(params);
  const { order } = await searchParams;
  const me = await getCustomer();
  return (
    <div className="wrap page">
      <TrackForm lang={lang} initialOrderNo={order?.slice(0, 20) ?? ''} loggedIn={me !== null} />
    </div>
  );
}
