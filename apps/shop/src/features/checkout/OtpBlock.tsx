'use client';
import { localizeDigits } from '@bdc/i18n';
import { useEffect, useState } from 'react';
import { Field, Notice } from '~/features/account/Field';
import { call, cleanCode } from '~/features/account/lib';
import { dict, fmt, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import s from './checkout.module.css';
import { checkoutError } from './errors';

/**
 * Q81 guest-COD verification: SMS a code to the order phone, then collect it.
 * Mount it with `key={phone}` so changing the number starts over.
 */
export function OtpBlock({
  lang,
  phone,
  code,
  onCode,
  error,
}: {
  lang: Lang;
  /** Normalised 01XXXXXXXXX, or null while the phone field is not valid yet. */
  phone: string | null;
  code: string;
  onCode: (code: string) => void;
  error?: string | null;
}) {
  const d = dict(lang).checkout;
  const [sent, setSent] = useState(false);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function send() {
    if (!phone) return;
    setBusy(true);
    setMsg(null);
    const r = await call(browserApi.POST('/v1/checkout/otp', { body: { phone } }));
    setBusy(false);
    if (r.ok) {
      const again = sent;
      setSent(true);
      setLeft(r.data.resendInSec);
      if (again) setMsg({ kind: 'ok', text: d.resent });
    } else {
      setMsg({ kind: 'error', text: checkoutError(r, d.errors) });
    }
  }

  return (
    <section className={s.card} aria-labelledby="co-verify">
      <h2 id="co-verify" className={s.cardTitle}>
        {d.verifyTitle}
      </h2>
      <p className={s.muted}>{d.verifyBody}</p>
      {!sent ? (
        <button type="button" className="btn btn-ghost" disabled={!phone || busy} onClick={send}>
          {d.sendCode}
        </button>
      ) : (
        <>
          <p className={s.muted}>
            {fmt(d.codeSentTo, { phone: localizeDigits(phone ?? '', lang) })}
          </p>
          <Field
            label={d.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            error={error}
            onChange={(e) => onCode(cleanCode(e.target.value))}
          />
          <div>
            <button type="button" className={s.linkBtn} disabled={left > 0 || busy} onClick={send}>
              {left > 0 ? fmt(d.resendIn, { s: localizeDigits(left, lang) }) : d.resend}
            </button>
          </div>
        </>
      )}
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
    </section>
  );
}
