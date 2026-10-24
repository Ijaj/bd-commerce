import type { Metadata } from 'next';
import { getCustomer, sessionCookie } from '~/features/account/server';
import type { PlacedOrder } from '~/features/checkout/errors';
import { SuccessView } from '~/features/checkout/SuccessView';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { serverApi } from '~/lib/api';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({
  params,
}: LangProps<{ orderNo: string }>): Promise<Metadata> {
  const { lang, orderNo } = await routeParams(params);
  return {
    title: dict(lang).checkout.success.title,
    alternates: alternatesFor(lang, `/order/${orderNo}`),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps<{ orderNo: string }>) {
  const { lang, orderNo } = await routeParams(params);
  const [me, cookie] = await Promise.all([getCustomer(), sessionCookie()]);
  let server: PlacedOrder | null = null;
  if (me && cookie) {
    const r = await serverApi({ cookie }).GET('/v1/customer/orders/{orderNo}', {
      params: { path: { orderNo } },
    });
    if (r.response.ok && r.data) {
      const o = r.data;
      server = {
        orderNo: o.orderNo,
        grandTotalP: o.money.grandTotalP,
        codDueP: o.money.codDueP,
        etaMinDays: o.zone.etaMinDays,
        etaMaxDays: o.zone.etaMaxDays,
        zoneName: lang === 'bn' && o.zone.nameBn ? o.zone.nameBn : o.zone.nameEn,
      };
    }
  }
  return <SuccessView lang={lang} orderNo={orderNo} server={server} loggedIn={me !== null} />;
}
