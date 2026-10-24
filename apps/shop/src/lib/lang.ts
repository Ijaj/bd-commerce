import type { Lang } from '@bdc/i18n';
import { notFound } from 'next/navigation';
import { parseLang } from '~/i18n';

/** Props of every page/layout under app/[lang]. Intersect with extra route params: `LangProps<{ slug: string }>`. */
export type LangProps<P extends object = object> = { params: Promise<{ lang: string } & P> };

/**
 * Language of the current route. `await` the params and call this first in every page,
 * layout and generateMetadata; it 404s on an unsupported segment.
 *   const { lang, slug } = await routeParams(params);
 */
export async function routeParams<P extends { lang: string }>(
  params: Promise<P>,
): Promise<Omit<P, 'lang'> & { lang: Lang }> {
  const p = await params;
  const lang = parseLang(p.lang);
  if (!lang) notFound();
  return { ...p, lang };
}
