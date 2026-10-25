import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Carousel } from '~/features/home/Carousel';
import { CategoryMenu } from '~/features/home/CategoryMenu';
import { getCategoryTree, getHome } from '~/features/home/data';
import { FeaturedCategories } from '~/features/home/FeaturedCategories';
import { Feed, FeedSkeleton } from '~/features/home/Feed';
import s from '~/features/home/Feed.module.css';
import h from '~/features/home/Hero.module.css';
import { DEFAULT_ROW_EVERY, jsonLd } from '~/features/home/logic';
import { HomeFlashStrip } from '~/features/promotions/HomeFlashStrip';
import { dict } from '~/i18n';
import { absoluteUrl, alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  const d = dict(lang).home;
  return {
    title: { absolute: d.metaTitle },
    description: d.metaDescription,
    alternates: alternatesFor(lang, '/'),
    openGraph: {
      title: d.metaTitle,
      description: d.metaDescription,
      url: absoluteUrl(href(lang, '/')),
      locale: lang === 'bn' ? 'bn_BD' : 'en_BD',
      alternateLocale: lang === 'bn' ? 'en_BD' : 'bn_BD',
    },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const d = dict(lang).home;
  const [home, tree] = await Promise.all([getHome(lang), getCategoryTree()]);
  const slides = home?.slides ?? [];
  const every = home?.feedRowEvery ?? DEFAULT_ROW_EVERY;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ShopName',
      url: absoluteUrl(href(lang, '/')),
      inLanguage: lang,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${absoluteUrl(href(lang, '/search'))}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'ShopName',
      url: absoluteUrl('/'),
    },
  ];

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON.stringify output with "<" escaped */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <h1 className="sr-only">{d.h1}</h1>
      {slides.length > 0 ? (
        <section className={`wrap ${h.hero}`} aria-label={d.featured}>
          <CategoryMenu tree={tree} lang={lang} />
          <Carousel
            slides={slides}
            lang={lang}
            labels={{
              region: d.promo,
              prev: d.prev,
              next: d.next,
              pause: d.pause,
              play: d.play,
              goTo: d.goTo,
              slideOf: d.slideOf,
            }}
          />
        </section>
      ) : null}
      <FeaturedCategories items={home?.featuredCategories ?? []} lang={lang} />
      <HomeFlashStrip lang={lang} />
      <section className={`wrap ${s.feed}`} aria-labelledby="h-feed">
        <div className={s.head}>
          <h2 id="h-feed">{d.justForYou}</h2>
        </div>
        <Suspense fallback={<FeedSkeleton lang={lang} />}>
          <Feed lang={lang} every={every} />
        </Suspense>
      </section>
    </>
  );
}
