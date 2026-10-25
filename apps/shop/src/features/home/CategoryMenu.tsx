import Link from 'next/link';
import { Icon } from '~/components/Icon';
import { Img } from '~/components/Img';
import { dict, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import type { CategoryNode } from '~/lib/types';
import s from './CategoryMenu.module.css';

/** Roots shown in the side menu; the rest are reachable through "All categories". */
const MAX_ROOTS = 10;

const url = (lang: Lang, c: CategoryNode) => href(lang, `/c/${c.slug}`);

/**
 * Desktop side menu beside the carousel. Pure CSS: a root's fly-out opens on :hover and
 * :focus-within (keyboard), no client JS. Levels 2-4 live in the fly-out: L2 headings,
 * L3 links, L4 as a small indented list under its L3.
 */
export function CategoryMenu({ tree, lang }: { tree: CategoryNode[]; lang: Lang }) {
  const d = dict(lang).home;
  if (tree.length === 0) return null;
  return (
    <nav className={s.menu} aria-label={d.catMenu}>
      <ul className={s.roots}>
        {tree.slice(0, MAX_ROOTS).map((c) => (
          <li key={c.id}>
            <Link className={s.root} href={url(lang, c)}>
              {c.icon ? (
                <Img className={s.ico} image={c.icon} alt="" sizes="24px" />
              ) : (
                <span
                  className={s.dot}
                  style={{ background: c.chipColor ?? 'var(--primary)' }}
                  aria-hidden="true"
                />
              )}
              <span className={s.name}>{pick(lang, c.nameEn, c.nameBn)}</span>
              {c.children.length > 0 ? <Icon className={s.chev} name="chevR" size={14} /> : null}
            </Link>
            {c.children.length > 0 ? (
              <div className={s.fly}>
                <div className={s.flyHead}>
                  <span>{pick(lang, c.nameEn, c.nameBn)}</span>
                  <Link className="link" href={url(lang, c)}>
                    {dict(lang).common.viewAll}
                    <Icon name="chevR" size={14} />
                  </Link>
                </div>
                {c.children.map((g) => (
                  <div key={g.id}>
                    <h3>
                      <Link href={url(lang, g)}>{pick(lang, g.nameEn, g.nameBn)}</Link>
                    </h3>
                    {g.children.length > 0 ? (
                      <ul>
                        {g.children.map((l) => (
                          <li key={l.id}>
                            <Link href={url(lang, l)}>{pick(lang, l.nameEn, l.nameBn)}</Link>
                            {l.children.length > 0 ? (
                              <ul className={s.l4}>
                                {l.children.map((x) => (
                                  <li key={x.id}>
                                    <Link href={url(lang, x)}>
                                      {pick(lang, x.nameEn, x.nameBn)}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        {tree.length > MAX_ROOTS ? (
          <li>
            <Link className={`${s.root} link`} href={href(lang, '/categories')}>
              <span className={s.name}>{d.allCategories}</span>
              <Icon className={s.chev} name="chevR" size={14} />
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
