import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '~/components/Breadcrumb';
import { Img } from '~/components/Img';
import { fetchListing } from '~/features/browse/api';
import { JsonLd } from '~/features/browse/JsonLd';
import { Listing } from '~/features/browse/Listing';
import s from '~/features/browse/Page.module.css';
import { isFiltered, parseListingQuery, type RawSearchParams } from '~/features/browse/query';
import { breadcrumbLd, plainText } from '~/features/browse/seo';
import { dict, pick } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export const revalidate = 60;

type Props = LangProps<{ slug: string[] }> & { searchParams: Promise<RawSearchParams> };

const lastSlug = (slug: string[]) => decodeURIComponent(slug[slug.length - 1] ?? '');

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang, slug } = await routeParams(params);
  const q = parseListingQuery(await searchParams);
  const data = await fetchListing(q, lastSlug(slug));
  const cat = data?.category;
  if (!cat) return { title: dict(lang).states.notFoundTitle, robots: { index: false } };
  const name = pick(lang, cat.nameEn, cat.nameBn);
  const path = `/c/${cat.slug}`;
  const pageSuffix = q.page > 1 && !isFiltered(q) ? `?page=${q.page}` : '';
  const image = cat.banner?.url1200;
  const description =
    cat.seoDescription ??
    plainText(pick(lang, cat.descriptionEn ?? '', cat.descriptionBn)) ??
    undefined;
  return {
    title: cat.seoTitle ?? name,
    description,
    alternates: alternatesFor(lang, `${path}${pageSuffix}`),
    robots: isFiltered(q) ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'website',
      title: cat.seoTitle ?? name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { lang, slug } = await routeParams(params);
  const q = parseListingQuery(await searchParams);
  const data = await fetchListing(q, lastSlug(slug));
  const cat = data?.category;
  if (!data || !cat) notFound();
  const d = dict(lang);
  const name = pick(lang, cat.nameEn, cat.nameBn);
  const desc = pick(lang, cat.descriptionEn ?? '', cat.descriptionBn);
  const path = `/c/${cat.slug}`;
  const root = cat.breadcrumb[0]?.slug ?? cat.slug;
  const hue = (([...root].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 3) + 1) as 1 | 2 | 3;

  return (
    <div className="wrap page">
      <JsonLd data={breadcrumbLd(lang, d.common.home, cat.breadcrumb)} />
      <Breadcrumb
        lang={lang}
        items={[
          { label: d.common.home, href: href(lang, '/') },
          ...cat.breadcrumb.map((c, i) => ({
            label: pick(lang, c.nameEn, c.nameBn),
            href: i === cat.breadcrumb.length - 1 ? undefined : href(lang, `/c/${c.slug}`),
          })),
        ]}
      />
      {cat.banner ? (
        <div className={s.banner}>
          <Img
            image={cat.banner}
            alt=""
            sizes="(max-width: 1360px) 100vw, 1360px"
            priority
            placeholderRatio={4}
          />
        </div>
      ) : null}
      {cat.banner ? (
        <>
          <h1 className={s.title}>{name}</h1>
          {desc ? <p className={s.lead}>{desc}</p> : null}
        </>
      ) : (
        <section className={`${s.catBanner} ${s[`sl${hue}`]} on-dark`}>
          <h1 className={s.catTitle}>{name}</h1>
          {desc ? <p className={s.catSub}>{desc}</p> : null}
        </section>
      )}
      {cat.children.length > 0 ? (
        <nav className={s.subcats} aria-label={d.browse.subCategories}>
          <ul>
            {cat.children.map((c) => (
              <li key={c.id}>
                <Link className={s.subcat} href={href(lang, `/c/${c.slug}`)}>
                  <Img
                    className={s.scImg}
                    image={c.image}
                    alt=""
                    sizes="64px"
                    placeholderRatio={1}
                  />
                  <span>{pick(lang, c.nameEn, c.nameBn)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <Listing lang={lang} path={path} q={q} data={data} />
    </div>
  );
}
