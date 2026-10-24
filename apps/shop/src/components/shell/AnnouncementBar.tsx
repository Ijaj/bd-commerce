import Link from 'next/link';
import { type Lang, t } from '~/i18n';
import type { SiteStatus } from '~/lib/types';
import s from './AnnouncementBar.module.css';

export function AnnouncementBar({ lang, site }: { lang: Lang; site: SiteStatus | null }) {
  const a = site?.announcement;
  if (!a) return null;
  const text = t(lang, a.text);
  if (!text) return null;
  const internal = a.link?.startsWith('/');
  return (
    <div className={`${s.bar} on-dark`}>
      <div className="wrap">
        {a.link ? (
          internal ? (
            <Link href={a.link}>{text}</Link>
          ) : (
            <a href={a.link} rel="noopener noreferrer">
              {text}
            </a>
          )
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  );
}
