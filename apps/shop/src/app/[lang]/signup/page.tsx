import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import s from '~/features/account/account.module.css';
import { safeNext } from '~/features/account/lib';
import { SignupForm } from '~/features/account/SignupForm';
import { getCustomer } from '~/features/account/server';
import { dict } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).account.signupTitle,
    alternates: alternatesFor(lang, '/signup'),
    robots: { index: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: LangProps & { searchParams: Promise<{ next?: string | string[] }> }) {
  const { lang } = await routeParams(params);
  const d = dict(lang).account;
  const next = safeNext((await searchParams).next, href(lang, '/account'));
  if (await getCustomer()) redirect(next);

  const qs = next === href(lang, '/account') ? '' : `?next=${encodeURIComponent(next)}`;
  return (
    <div className="wrap page">
      <div className={s.card}>
        <h1>{d.signupTitle}</h1>
        <p className={s.intro}>{d.signupIntro}</p>
        <SignupForm lang={lang} next={next} />
        <p className={s.foot}>
          {d.haveAccount}{' '}
          <Link className="link" href={`${href(lang, '/login')}${qs}`}>
            {d.loginLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
