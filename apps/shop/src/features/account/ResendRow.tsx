'use client';
import { localizeDigits } from '@bdc/i18n';
import { useEffect, useState } from 'react';
import { dict, fmt, type Lang } from '~/i18n';
import s from './account.module.css';
import { customerApi } from './api';
import { Notice } from './Field';
import { errorMessage } from './lib';

/** "Resend code in 42s" countdown, then a Resend button. `phone` must already be normalised. */
export function ResendRow({
  lang,
  phone,
  purpose,
  initialSeconds,
}: {
  lang: Lang;
  phone: string;
  purpose: 'signup' | 'reset';
  initialSeconds: number;
}) {
  const d = dict(lang).account;
  const [left, setLeft] = useState(initialSeconds);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function resend() {
    setBusy(true);
    setMsg(null);
    const r = await customerApi.requestOtp(phone, purpose);
    setBusy(false);
    if (r.ok) {
      setLeft(r.data.resendInSec);
      setMsg({ kind: 'ok', text: d.resent });
    } else {
      setMsg({ kind: 'error', text: errorMessage(r, d.errors) });
    }
  }

  return (
    <div>
      <button type="button" className={s.linkBtn} disabled={left > 0 || busy} onClick={resend}>
        {left > 0 ? fmt(d.resendIn, { s: localizeDigits(left, lang) }) : d.resend}
      </button>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
    </div>
  );
}
