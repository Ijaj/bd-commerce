'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Notice } from '~/features/account/Field';
import { call } from '~/features/account/lib';
import { dict, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { browserApi } from '~/lib/api-browser';
import { couponFacts, couponValueText } from './logic';
import s from './promotions.module.css';
import type { WalletCoupon } from './types';

/** The customer's coupon wallet. Only coupons they collected themselves can be removed. */
export function WalletList({ lang, initial }: { lang: Lang; initial: WalletCoupon[] }) {
  const t = dict(lang).promos;
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function uncollect(id: string) {
    setBusy(id);
    setError(false);
    const r = await call(
      browserApi.DELETE('/v1/customer/coupons/{couponId}', { params: { path: { couponId: id } } }),
    );
    setBusy(null);
    if (r.ok) setItems((all) => all.filter((c) => c.couponId !== id));
    else setError(true);
  }

  if (items.length === 0) {
    return (
      <div className={s.walletEmpty}>
        <p>{t.wallet.empty}</p>
        <p className={s.facts}>{t.wallet.emptyBody}</p>
        <Link className="btn btn-primary" href={href(lang, '/offers')}>
          {t.wallet.browse}
        </Link>
      </div>
    );
  }
  return (
    <>
      {error ? <Notice kind="error">{t.wallet.removeError}</Notice> : null}
      <ul className={s.coupons}>
        {items.map((c) => {
          const terms = pick(lang, c.termsEn ?? '', c.termsBn);
          const usable = c.state === 'usable';
          return (
            <li key={c.couponId} className={`${s.coupon} ${usable ? '' : s.couponOff}`}>
              <div className={s.couponHead}>
                <span className={s.couponValue}>{couponValueText(c, lang, t.coupon)}</span>
                <span className={`${s.state} ${usable ? s.stateOn : ''}`}>
                  {t.wallet.states[c.state]}
                </span>
              </div>
              <p className={s.couponName}>{c.name}</p>
              {c.code ? (
                <p className={s.facts}>
                  {t.coupon.code}: <span className={s.code}>{c.code}</span>
                </p>
              ) : null}
              <p className={s.facts}>
                {[t.wallet.sources[c.source], ...couponFacts(c, lang, t.coupon)].join(' · ')}
              </p>
              {terms ? <p className={s.terms}>{terms}</p> : null}
              {c.collected ? (
                <div className={s.couponAct}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy === c.couponId}
                    onClick={() => uncollect(c.couponId)}
                  >
                    {t.wallet.remove}
                    <span className="sr-only">: {c.name}</span>
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
