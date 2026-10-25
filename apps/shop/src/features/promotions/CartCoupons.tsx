'use client';
import { useEffect, useState } from 'react';
import { Notice } from '~/features/account/Field';
import { type ApiFail, call } from '~/features/account/lib';
import { applyCoupon, removeCoupon } from '~/features/cart/store';
import type { Cart } from '~/features/cart/types';
import { dict, fmt, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import { formatPrice } from '~/lib/format';
import s from './cartcoupons.module.css';
import { rejectText } from './logic';
import type { CouponSuggestion } from './types';

function applyError(e: ApiFail, t: ReturnType<typeof dict>['promos']['cart']): string {
  if (e.code === 'NETWORK') return t.network;
  if (e.code === 'COUPON_INVALID') {
    return rejectText(typeof e.body?.reason === 'string' ? e.body.reason : undefined, t.reasons);
  }
  if (e.status === 429) return t.tooMany;
  return t.generic;
}

/** Cart coupon area: typed code, applied offers (auto ones cannot be removed), one-tap suggestions. */
export function CartCoupons({ lang, cart }: { lang: Lang; cart: Cart }) {
  const t = dict(lang).promos.cart;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CouponSuggestion[]>([]);
  // The API reports dropped codes once, on the read that dropped them: keep them on screen.
  const [dropped, setDropped] = useState(cart.rejectedCodes);

  useEffect(() => {
    if (cart.rejectedCodes.length > 0) setDropped(cart.rejectedCodes);
  }, [cart.rejectedCodes]);

  const key = `${cart.codes.join(',')}|${cart.subtotalP}|${cart.count}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: key encodes the cart parts that change suggestions
  useEffect(() => {
    let live = true;
    void call(browserApi.GET('/v1/cart/coupon-suggestions')).then((r) => {
      if (live) setSuggestions(r.ok ? r.data.items : []);
    });
    return () => {
      live = false;
    };
  }, [key]);

  async function apply(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const r = await applyCoupon(value);
    setBusy(false);
    if (!r.ok) {
      setError(applyError(r, t));
      return;
    }
    setCode('');
    setDropped([]);
  }

  async function remove(c: string) {
    setError(null);
    setBusy(true);
    const next = await removeCoupon(c);
    setBusy(false);
    if (!next) setError(t.removeError);
  }

  const shown = suggestions.filter((x) => x.code && x.savingP > 0).slice(0, 3);
  return (
    <section className={s.box} aria-labelledby="cart-coupon">
      <h3 id="cart-coupon" className={s.title}>
        {t.boxTitle}
      </h3>
      {dropped.map((d) => (
        <Notice key={d.code} kind="error">
          {fmt(t.droppedCode, { code: d.code, reason: rejectText(d.reason, t.reasons) })}
        </Notice>
      ))}
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          void apply(code);
        }}
      >
        <label className="sr-only" htmlFor="cart-coupon-in">
          {t.label}
        </label>
        <input
          id="cart-coupon-in"
          className="input"
          placeholder={t.placeholder}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'cart-coupon-err' : undefined}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
        />
        <button type="submit" className="btn btn-ghost" disabled={busy || !code.trim()}>
          {busy ? t.applying : t.apply}
        </button>
      </form>
      {error ? (
        <p id="cart-coupon-err" className={s.err} role="alert">
          {error}
        </p>
      ) : null}
      {cart.appliedCoupons.length > 0 ? (
        <ul className={s.applied} aria-label={t.appliedTitle}>
          {cart.appliedCoupons.map((c) => (
            <li key={c.couponId} className={s.appliedRow}>
              <span className={s.appliedName}>
                {c.name}
                {c.code ? <span className={s.codeTag}>{c.code}</span> : null}
                {c.freeDelivery ? <span className={s.codeTag}>{t.freeDelivery}</span> : null}
              </span>
              {c.amountP > 0 ? (
                <span className={s.good}>−{formatPrice(c.amountP, lang)}</span>
              ) : null}
              {c.kind === 'code' && c.code ? (
                <button
                  type="button"
                  className={s.removeBtn}
                  disabled={busy}
                  onClick={() => remove(c.code as string)}
                >
                  {fmt(t.remove, { code: c.code })}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {shown.length > 0 ? (
        <ul className={s.suggest}>
          {shown.map((x) => (
            <li key={x.couponId}>
              <button
                type="button"
                className={s.suggestBtn}
                disabled={busy}
                onClick={() => apply(x.code as string)}
              >
                {fmt(t.suggestion, { code: x.code as string, amt: formatPrice(x.savingP, lang) })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
