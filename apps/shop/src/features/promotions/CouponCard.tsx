'use client';
import Link from 'next/link';
import { useState } from 'react';
import { call } from '~/features/account/lib';
import { useSession } from '~/features/account/session';
import { dict, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { browserApi } from '~/lib/api-browser';
import { couponFacts, couponValueText } from './logic';
import s from './promotions.module.css';
import type { PublicCoupon } from './types';

/**
 * One public coupon: value, facts, terms, then either a copyable code or a collect button
 * (auto coupons need neither: they apply at checkout). Collecting needs a login.
 */
export function CouponCard({
  coupon: c,
  lang,
  nextPath,
}: {
  coupon: PublicCoupon;
  lang: Lang;
  /** Where to return after login (a language-less path). */
  nextPath: string;
}) {
  const t = dict(lang).promos.coupon;
  const { ready, me } = useSession();
  const [collected, setCollected] = useState(c.collected ?? false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const terms = pick(lang, c.termsEn ?? '', c.termsBn);
  const facts = couponFacts(c, lang, t);
  const isCollected = collected || c.collected === true;

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.code ?? '');
      setNote(t.copied);
    } catch {
      setNote(t.copyFailed);
    }
  }

  async function collect() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await call(
      browserApi.POST('/v1/customer/coupons/{couponId}/collect', {
        params: { path: { couponId: c.id } },
      }),
    );
    setBusy(false);
    // 409 = already collected: same end state for the shopper.
    if (r.ok || r.status === 409) setCollected(true);
    else setNote(t.collectError);
  }

  return (
    <li className={s.coupon}>
      <div className={s.couponHead}>
        <span className={s.couponValue}>{couponValueText(c, lang, t)}</span>
        <span className={s.couponName}>{c.name}</span>
      </div>
      {facts.length > 0 ? <p className={s.facts}>{facts.join(' · ')}</p> : null}
      {terms ? <p className={s.terms}>{terms}</p> : null}
      <div className={s.couponAct}>
        {c.kind === 'auto' ? (
          <span className={s.facts}>{t.autoApplied}</span>
        ) : (
          <>
            {c.code ? (
              <button type="button" className={s.codeBtn} onClick={copy}>
                <span className="sr-only">{t.copy}: </span>
                <span className={s.code}>{c.code}</span>
                <span aria-hidden="true">{t.copy}</span>
              </button>
            ) : null}
            {c.isCollectable ? (
              isCollected ? (
                <span className={s.collected}>{t.collected}</span>
              ) : ready && !me ? (
                <Link
                  className="btn btn-ghost"
                  href={`${href(lang, '/login')}?next=${encodeURIComponent(href(lang, nextPath))}`}
                >
                  {t.loginToCollect}
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || !ready}
                  onClick={collect}
                >
                  {busy ? t.collecting : t.collect}
                </button>
              )
            ) : null}
          </>
        )}
      </div>
      <p className={s.note} role="status">
        {note}
      </p>
    </li>
  );
}
