import type { Metadata } from 'next';
import { ComingSoon } from '~/components/States';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

// PLACEHOLDER: replace this page's body (keep routeParams + alternatesFor).
export async function generateMetadata({
  params,
}: LangProps<{ slug: string[] }>): Promise<Metadata> {
  const { lang, slug } = await routeParams(params);
  return {
    title: dict(lang).pages.category,
    alternates: alternatesFor(lang, `/c/${slug.join('/')}`),
  };
}

export default async function Page({ params }: LangProps<{ slug: string[] }>) {
  const { lang } = await routeParams(params);
  return <ComingSoon lang={lang} title={dict(lang).pages.category} />;
}
