import type { Metadata } from 'next';
import { ComingSoon } from '~/components/States';
import { alternatesFor } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

// PLACEHOLDER: replace this page's body (keep routeParams + alternatesFor).
export async function generateMetadata({ params }: LangProps<{ slug: string }>): Promise<Metadata> {
  const { lang, slug } = await routeParams(params);
  return {
    title: slug,
    alternates: alternatesFor(lang, `/pages/${slug}`),
  };
}

export default async function Page({ params }: LangProps<{ slug: string }>) {
  const { lang, slug } = await routeParams(params);
  return <ComingSoon lang={lang} title={slug} />;
}
