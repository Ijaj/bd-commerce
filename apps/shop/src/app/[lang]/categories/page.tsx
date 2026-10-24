import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EmptyState } from '~/components/States';
import { fetchCategoryTree } from '~/features/browse/api';
import s from '~/features/browse/Page.module.css';
import { dict, pick } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';
import type { CategoryNode } from '~/lib/types';

export const revalidate = 300;

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).pages.categories,
    description: dict(lang).browse.allCategoriesBody,
    alternates: alternatesFor(lang, '/categories'),
  };
}

function flatten(
  nodes: CategoryNode[],
  out: { node: CategoryNode; depth: number }[] = [],
  depth = 2,
) {
  for (const n of nodes) {
    out.push({ node: n, depth });
    flatten(n.children, out, Math.min(depth + 1, 3));
  }
  return out;
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const d = dict(lang);
  const tree = await fetchCategoryTree();
  return (
    <div className="wrap page">
      <Breadcrumb
        lang={lang}
        items={[{ label: d.common.home, href: href(lang, '/') }, { label: d.pages.categories }]}
      />
      <h1 className={s.title}>{d.pages.categories}</h1>
      {tree.length === 0 ? (
        <EmptyState lang={lang} />
      ) : (
        <div className={s.tree}>
          {tree.map((root) => (
            <section key={root.id} className={s.group}>
              <h2>
                <Link href={href(lang, `/c/${root.slug}`)}>
                  {pick(lang, root.nameEn, root.nameBn)}
                </Link>
              </h2>
              <div className={s.sub}>
                {flatten(root.children).map(({ node, depth }) => (
                  <Link
                    key={node.id}
                    className={depth > 2 ? s.lv3 : undefined}
                    href={href(lang, `/c/${node.slug}`)}
                  >
                    {pick(lang, node.nameEn, node.nameBn)}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
