import Link from 'next/link';
import { Icon } from '~/components/Icon';
import { Img } from '~/components/Img';
import { dict, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import type { CategoryNode } from '~/lib/types';
import s from './CategoryMenu.module.css';

const url = (lang: Lang, c: CategoryNode) => href(lang, `/c/${c.slug}`);

/**
 * Desktop side menu beside the carousel. Pure CSS: a root's fly-out opens on :hover and
 * :focus-within (keyboard), no client JS. Levels 2-4 live in the fly-out: L2 headings,
 * L3 links, L4 as a small indented list under its L3.
 */
export function CategoryMenu({ tree, lang }: { tree: CategoryNode[]; lang: Lang }) {
  if (tree.length === 0) return null;
  return (
    <nav className={s.menu} aria-label={dict(lang).home.catMenu}>
      <ul className={s.roots}>
        {tree.map((c) => (
          <li key={c.id}>
            <Link className={s.root} href={url(lang, c)}>
              {c.icon ? <Img className={s.ico} image={c.icon} alt="" sizes="24px" /> : null}
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
      </ul>
    </nav>
  );
}
