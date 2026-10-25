import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '~/components/Icon';
import s from '~/features/account/account.module.css';
import { LogoutButton } from '~/features/account/LogoutButton';
import { PasswordForm } from '~/features/account/PasswordForm';
import { ProfileForm } from '~/features/account/ProfileForm';
import { SessionSeed } from '~/features/account/SessionSeed';
import { requireCustomer } from '~/features/account/server';
import { dict, fmt } from '~/i18n';
import { alternatesFor, href } from '~/i18n/routing';
import { type LangProps, routeParams } from '~/lib/lang';

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    title: dict(lang).account.accountTitle,
    alternates: alternatesFor(lang, '/account'),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: LangProps) {
  const { lang } = await routeParams(params);
  const d = dict(lang).account;
  const r = dict(lang).returns;
  const w = dict(lang).promos.wallet;
  const { me } = await requireCustomer(lang, '/account');

  // Orders and addresses are built in step 4; the links are ready for them.
  const tiles: { path: string; icon: IconName; title: string; hint: string }[] = [
    { path: '/account/orders', icon: 'pkg', title: d.orders, hint: d.ordersHint },
    { path: '/account/returns', icon: 'tag', title: r.accountTile, hint: r.accountTileHint },
    { path: '/account/coupons', icon: 'tag', title: w.accountTile, hint: w.accountTileHint },
    { path: '/account/addresses', icon: 'home', title: d.addresses, hint: d.addressesHint },
    { path: '/wishlist', icon: 'heart', title: d.wishlist, hint: d.wishlistHint },
  ];

  return (
    <div className="wrap page">
      <SessionSeed me={me} />
      <div className={s.wishTop}>
        <h1 className="page-title">{fmt(d.hello, { name: me.name })}</h1>
        <LogoutButton lang={lang} />
      </div>
      <div className={s.home}>
        <div className={s.tiles}>
          {tiles.map((t) => (
            <Link key={t.path} className={s.tile} href={href(lang, t.path)}>
              <Icon name={t.icon} size={26} />
              <span className={s.tileText}>
                <span>{t.title}</span>
                <span className={s.tileHint}>{t.hint}</span>
              </span>
            </Link>
          ))}
        </div>
        <section className={s.panel} aria-labelledby="acc-profile">
          <h2 id="acc-profile">{d.profile}</h2>
          <ProfileForm lang={lang} me={me} />
        </section>
        <section className={s.panel} aria-labelledby="acc-pw">
          <h2 id="acc-pw">{d.passwordSection}</h2>
          <PasswordForm lang={lang} />
        </section>
      </div>
    </div>
  );
}
