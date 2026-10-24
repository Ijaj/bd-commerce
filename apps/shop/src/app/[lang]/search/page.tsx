import type { Metadata } from 'next';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EmptyState } from '~/components/States';
import { fetchListing } from '~/features/browse/api';
import { Listing } from '~/features/browse/Listing';
import s from '~/features/browse/Page.module.css';
import { parseListingQuery, type RawSearchParams } from '~/features/browse/query';
import { dict, fmt, pick } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

type Props = LangProps & { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang } = await routeParams(params);
  const q = parseListingQuery(await searchParams);
  const d = dict(lang);
  return {
    title: q.q ? fmt(d.browse.searchTitle, { q: q.q }) : d.pages.search,
    alternates: alternatesFor(lang, '/search'),
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { lang } = await routeParams(params);
  const q = parseListingQuery(await searchParams);
  const d = dict(lang);
  const crumbs = [{ label: d.common.home, href: href(lang, '/') }, { label: d.pages.search }];

  if (!q.q && q.brand.length === 0) {
    return (
      <div className="wrap page">
        <Breadcrumb lang={lang} items={crumbs} />
        <h1 className={s.title}>{d.pages.search}</h1>
        <EmptyState lang={lang} title={d.browse.searchPrompt} body={d.browse.searchPromptBody} />
      </div>
    );
  }

  const data = await fetchListing(q);
  const brandName = (() => {
    if (q.q || q.brand.length !== 1) return null;
    const b = data?.facets.brands.find((x) => x.slug === q.brand[0]);
    return b ? pick(lang, b.nameEn, b.nameBn) : q.brand[0];
  })();
  const heading = q.q
    ? fmt(d.browse.searchTitle, { q: q.q })
    : brandName
      ? fmt(d.browse.searchBrand, { brand: brandName })
      : d.pages.search;

  return (
    <div className="wrap page">
      <Breadcrumb lang={lang} items={crumbs} />
      <h1 className={s.title}>{heading}</h1>
      {data ? (
        <Listing lang={lang} path="/search" q={q} data={data} hiddenQ />
      ) : (
        <EmptyState lang={lang} title={d.browse.noResults} body={d.browse.noResultsBody} />
      )}
    </div>
  );
}
