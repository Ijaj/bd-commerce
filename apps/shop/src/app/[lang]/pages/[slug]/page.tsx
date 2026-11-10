import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '~/components/Breadcrumb';
import { plainText } from '~/features/browse/seo';
import { fetchPage } from '~/features/pages/data';
import { pageBody, pageTitle } from '~/features/pages/logic';
import s from '~/features/pages/pages.module.css';
import { dict } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export const revalidate = 60;

// No paths at build time: rendered on first request, then cached and revalidated (ISR).
export function generateStaticParams() {
  return [];
}

type Props = LangProps<{ slug: string }>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await routeParams(params);
  const page = await fetchPage(decodeURIComponent(slug));
  if (!page) return { title: dict(lang).states.notFoundTitle, robots: { index: false } };
  const title = page.seoTitle ?? pageTitle(lang, page);
  const description = page.seoDescription ?? plainText(pageBody(lang, page));
  return {
    title,
    description,
    alternates: alternatesFor(lang, `/pages/${page.slug}`),
    openGraph: { type: 'website', title, description },
  };
}

export default async function Page({ params }: Props) {
  const { lang, slug } = await routeParams(params);
  const page = await fetchPage(decodeURIComponent(slug));
  if (!page) notFound();
  const title = pageTitle(lang, page);
  const html = pageBody(lang, page);
  return (
    <div className="wrap page">
      <Breadcrumb
        lang={lang}
        items={[{ label: dict(lang).common.home, href: href(lang, '/') }, { label: title }]}
      />
      <h1 className="page-title">{title}</h1>
      {/* HTML is sanitized by the API (allow-list) before it is stored/served */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized server-side */}
      <div className={s.prose} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
