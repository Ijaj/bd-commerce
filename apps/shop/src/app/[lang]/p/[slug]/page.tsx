import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '~/components/Breadcrumb';
import { fetchProduct, fetchSimilar } from '~/features/browse/api';
import { JsonLd } from '~/features/browse/JsonLd';
import { youtubeId } from '~/features/browse/logic';
import s from '~/features/browse/Product.module.css';
import { ProductRow } from '~/features/browse/ProductRow';
import { ProductView } from '~/features/browse/ProductView';
import { RecentlyViewed } from '~/features/browse/RecentlyViewed';
import { breadcrumbLd, plainText } from '~/features/browse/seo';
import type { ProductDetail } from '~/features/browse/types';
import { YouTubeLite } from '~/features/browse/YouTubeLite';
import { CouponsSection } from '~/features/promotions/CouponsSection';
import { dict, fmt, type Lang, pick } from '~/i18n';
import { absoluteUrl, alternatesFor, href } from '~/i18n/routing';
import { formatCompact, formatRating, localizeDigits } from '~/lib/format';
import { type LangProps, routeParams } from '~/lib/lang';

export const revalidate = 60;

// No paths at build time: pages are rendered on first request, then cached and revalidated (ISR).
export function generateStaticParams() {
  return [];
}

type Props = LangProps<{ slug: string }>;

function descriptionOf(p: ProductDetail, lang: Lang) {
  return pick(lang, p.descriptionHtmlEn ?? '', p.descriptionHtmlBn);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await routeParams(params);
  const p = await fetchProduct(decodeURIComponent(slug));
  if (!p) return { title: dict(lang).states.notFoundTitle, robots: { index: false } };
  const title = pick(lang, p.titleEn, p.titleBn);
  const description =
    p.seoDescription ??
    plainText(pick(lang, p.shortDescriptionEn ?? '', p.shortDescriptionBn)) ??
    plainText(descriptionOf(p, lang));
  const img = p.images[0];
  return {
    title: p.seoTitle ?? title,
    description,
    alternates: alternatesFor(lang, `/p/${p.slug}`),
    openGraph: {
      type: 'website',
      title: p.seoTitle ?? title,
      description,
      ...(img ? { images: [{ url: img.url1200, width: img.width, height: img.height }] } : {}),
    },
    twitter: { card: img ? 'summary_large_image' : 'summary' },
  };
}

const taka = (paisa: number) => (paisa / 100).toFixed(2);

function productLd(p: ProductDetail, lang: Lang, description: string | undefined) {
  const active = p.variants.filter((v) => v.isActive);
  const prices = active.map((v) => v.priceP);
  const inStock = active.some((v) => v.available > 0);
  const availability =
    p.isUpcoming || p.isPreorder
      ? 'https://schema.org/PreOrder'
      : inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock';
  const url = absoluteUrl(href(lang, `/p/${p.slug}`));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const offers =
    prices.length === 0
      ? undefined
      : lo === hi || active.length === 1
        ? {
            '@type': 'Offer',
            url,
            priceCurrency: 'BDT',
            price: taka(lo),
            availability,
            itemCondition: 'https://schema.org/NewCondition',
          }
        : {
            '@type': 'AggregateOffer',
            url,
            priceCurrency: 'BDT',
            lowPrice: taka(lo),
            highPrice: taka(hi),
            offerCount: active.length,
            availability,
          };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pick(lang, p.titleEn, p.titleBn),
    ...(description ? { description } : {}),
    ...(p.images.length ? { image: p.images.map((i) => i.url1200) } : {}),
    sku: active[0]?.sku,
    url,
    ...(p.brand
      ? { brand: { '@type': 'Brand', name: pick(lang, p.brand.nameEn, p.brand.nameBn) } }
      : {}),
    ...(offers ? { offers } : {}),
    ...(p.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: p.ratingAvg.toFixed(1),
            reviewCount: p.ratingCount,
          },
        }
      : {}),
  };
}

function Stars({ avg, label }: { avg: number; label: string }) {
  const full = Math.round(avg);
  return (
    <span className={s.stars} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? s.starOn : s.starOff} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export default async function Page({ params }: Props) {
  const { lang, slug } = await routeParams(params);
  const p = await fetchProduct(decodeURIComponent(slug));
  if (!p) notFound();
  const similar = await fetchSimilar(p.slug);
  const d = dict(lang);
  const b = d.browse;
  const title = pick(lang, p.titleEn, p.titleBn);
  const html = descriptionOf(p, lang);
  const short = pick(lang, p.shortDescriptionEn ?? '', p.shortDescriptionBn);
  const video = youtubeId(p.youtubeUrl);
  const date = p.preorderExpectedDate
    ? new Date(p.preorderExpectedDate).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;

  const header = (
    <div className={s.head}>
      <h1 className={s.title}>{title}</h1>
      <div className={s.meta}>
        {p.ratingCount > 0 ? (
          <span className={s.metaItem}>
            <Stars
              avg={p.ratingAvg}
              label={`${formatRating(p.ratingAvg, lang)} / ${localizeDigits(5, lang)}`}
            />
            <span>{formatRating(p.ratingAvg, lang)}</span>
            <span className={s.muted}>
              ({fmt(b.reviewsN, { n: localizeDigits(p.ratingCount, lang) })})
            </span>
          </span>
        ) : (
          <span className={`${s.metaItem} ${s.muted}`}>{b.noReviews}</span>
        )}
        {p.soldCount > 0 ? (
          <span className={s.metaItem}>
            {formatCompact(p.soldCount, lang)} {d.common.sold}
          </span>
        ) : null}
        {p.brand ? (
          <span className={s.metaItem}>
            {b.brandLabel}:{' '}
            <Link
              className="link"
              href={`${href(lang, '/search')}?brand=${encodeURIComponent(p.brand.slug)}`}
            >
              {pick(lang, p.brand.nameEn, p.brand.nameBn)}
            </Link>
          </span>
        ) : null}
      </div>
      {short ? <p className={s.short}>{short}</p> : null}
    </div>
  );

  return (
    <div className="wrap page">
      <JsonLd data={productLd(p, lang, plainText(short || html))} />
      <JsonLd
        data={breadcrumbLd(lang, d.common.home, p.breadcrumb, {
          name: title,
          path: `/p/${p.slug}`,
        })}
      />
      <Breadcrumb
        lang={lang}
        items={[
          { label: d.common.home, href: href(lang, '/') },
          ...p.breadcrumb.map((c) => ({
            label: pick(lang, c.nameEn, c.nameBn),
            href: href(lang, `/c/${c.slug}`),
          })),
          { label: title },
        ]}
      />

      <ProductView product={p} lang={lang} header={header} preorderDate={date} />
      <CouponsSection
        lang={lang}
        slug={p.slug}
        nextPath={`/p/${p.slug}`}
        heading={dict(lang).promos.product.title}
      />

      {html ? (
        <section className={s.sec} aria-labelledby="desc-h">
          <div className="sec-head">
            <h2 id="desc-h">{b.description}</h2>
          </div>
          {/* HTML is sanitized by the API (allow-list) before it is stored/served */}
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized server-side */}
          <div className={s.prose} dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      ) : null}

      {p.specs.length > 0 ? (
        <section className={s.sec} aria-labelledby="spec-h">
          <div className="sec-head">
            <h2 id="spec-h">{b.specs}</h2>
          </div>
          <table className={s.specs}>
            <tbody>
              {p.specs.map((x) => (
                <tr key={x.nameEn}>
                  <th scope="row">{pick(lang, x.nameEn, x.nameBn)}</th>
                  <td>
                    {pick(lang, x.valueEn, x.valueBn)}
                    {x.unit ? ` ${x.unit}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {video ? (
        <section className={s.sec} aria-labelledby="vid-h">
          <div className="sec-head">
            <h2 id="vid-h">{b.video}</h2>
          </div>
          <YouTubeLite id={video} title={title} playLabel={b.playVideo} />
        </section>
      ) : null}

      <ProductRow title={b.similar} products={similar} lang={lang} />
      <RecentlyViewed productId={p.id} lang={lang} />
    </div>
  );
}
