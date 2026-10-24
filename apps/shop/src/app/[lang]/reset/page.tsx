import type { Metadata } from 'next';
import Link from 'next/link';
import s from '~/features/account/account.module.css';
import { ResetForm } from '~/features/account/ResetForm';
import { dict } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).account.resetTitle,
    alternates: alternatesFor(lang, '/reset'),
    robots: { index: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const d = dict(lang).account;
  return (
    <div className="wrap page">
      <div className={s.card}>
        <h1>{d.resetTitle}</h1>
        <ResetForm lang={lang} />
        <p className={s.foot}>
          <Link className="link" href={href(lang, '/login')}>
            {d.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
