import { dict, type Lang, t } from '~/i18n';
import type { SiteStatus } from '~/lib/types';
import { Logo } from './Logo';
import s from './Maintenance.module.css';

export function Maintenance({ lang, site }: { lang: Lang; site: SiteStatus }) {
  const d = dict(lang).maintenance;
  const msg = t(lang, site.maintenance.message) || d.body;
  return (
    <main className={s.page} id="main">
      <div className={s.logo}>
        <Logo lang={lang} />
      </div>
      <h1>{d.title}</h1>
      <p>{msg}</p>
    </main>
  );
}
