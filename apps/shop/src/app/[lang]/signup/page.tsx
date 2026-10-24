import type { Metadata } from 'next';
import { ComingSoon } from '~/components/States';
import { dict } from '~/i18n';
import { alternatesFor } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

// PLACEHOLDER: replace this page's body (keep routeParams + alternatesFor).
export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).pages.signup,
    alternates: alternatesFor(lang, '/signup'),
    robots: { index: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  return <ComingSoon lang={lang} title={dict(lang).pages.signup} />;
}
