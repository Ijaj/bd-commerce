import Link from 'next/link';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import type { SiteStatus } from '~/lib/types';
import s from './Footer.module.css';
import { Logo } from './Logo';

export function Footer({ lang, contact }: { lang: Lang; contact?: SiteStatus['contact'] }) {
  const d = dict(lang).footer;
  return (
    <footer className={`${s.foot} on-dark`}>
      <div className="wrap">
        <div className={s.grid}>
          <div className={s.about}>
            <Logo lang={lang} />
            <p>{d.about}</p>
          </div>
          <div>
            <h3>{d.company}</h3>
            <ul>
              <li>
                <Link href={href(lang, '/pages/about')}>{d.aboutUs}</Link>
              </li>
              <li>
                <Link href={href(lang, '/pages/contact')}>{d.contact}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>{d.care}</h3>
            <ul>
              <li>
                <Link href={href(lang, '/track')}>{d.track}</Link>
              </li>
              {contact?.hotline ? (
                <li>
                  <a href={`tel:${contact.hotline.replace(/[^+\d]/g, '')}`}>{contact.hotline}</a>
                </li>
              ) : null}
              {contact?.email ? (
                <li>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <h3>{d.weAccept}</h3>
            <div className={s.pays}>
              <span>COD</span>
            </div>
          </div>
        </div>
        <p className={s.copy}>{d.copyright}</p>
      </div>
    </footer>
  );
}
