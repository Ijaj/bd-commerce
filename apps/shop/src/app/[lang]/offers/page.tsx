import type { Metadata } from 'next';
import { ErrorState } from '~/components/States';
import { fetchFlashSales, fetchPublicCoupons } from '~/features/promotions/api';
import { CouponsSection } from '~/features/promotions/CouponsSection';
import { FlashSaleBlock } from '~/features/promotions/FlashSales';
import s from '~/features/promotions/promotions.module.css';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).pages.offers,
    description: dict(lang).promos.offers.intro,
    alternates: alternatesFor(lang, '/offers'),
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const t = dict(lang).promos.offers;
  const [flash, coupons] = await Promise.all([fetchFlashSales(), fetchPublicCoupons()]);
  if (!flash && !coupons) {
    return (
      <div className="wrap page">
        <h1 className="page-title">{t.title}</h1>
        <ErrorState lang={lang} body={t.loadError} />
      </div>
    );
  }
  const live = flash?.live ?? [];
  const upcoming = flash?.upcoming ?? [];
  return (
    <div className="wrap page">
      <h1 className="page-title">{t.title}</h1>
      <p className={s.facts}>{t.intro}</p>
      {live.length > 0 ? (
        live.map((sale) => <FlashSaleBlock key={sale.id} sale={sale} lang={lang} />)
      ) : (
        <section className={s.section} aria-label={t.flashTitle}>
          <h2 className={s.sectionTitle}>{t.flashTitle}</h2>
          <p className={s.facts}>{t.flashEmpty}</p>
        </section>
      )}
      {upcoming.length > 0 ? (
        <>
          <h2 className={`${s.sectionTitle} ${s.section}`}>{t.upcomingTitle}</h2>
          {upcoming.map((sale) => (
            <FlashSaleBlock key={sale.id} sale={sale} lang={lang} upcoming max={6} />
          ))}
        </>
      ) : null}
      <CouponsSection
        lang={lang}
        initial={coupons ?? []}
        nextPath="/offers"
        heading={t.couponsTitle}
        empty={t.couponsEmpty}
      />
    </div>
  );
}
