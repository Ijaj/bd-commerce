'use client';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import s from './account.module.css';
import { customerApi } from './api';
import { Field, Notice, PasswordField } from './Field';
import { cleanCode, errorMessage, normalizePhone } from './lib';
import { ResendRow } from './ResendRow';

type Errs = Partial<Record<'phone' | 'password' | 'code', string>>;

/** phone -> code + new password -> done. An unknown phone behaves the same (no enumeration). */
export function ResetForm({ lang }: { lang: Lang }) {
  const d = dict(lang).account;
  const [phoneIn, setPhoneIn] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<{ phone: string; sentTo: string; resendInSec: number } | null>(
    null,
  );
  const [done, setDone] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const phone = normalizePhone(phoneIn);
    setErrs({ phone: phone ? undefined : d.errors.phoneInvalid });
    setError(null);
    if (!phone) return;
    setBusy(true);
    const r = await customerApi.requestOtp(phone, 'reset');
    setBusy(false);
    if (!r.ok) {
      setError(errorMessage(r, d.errors));
      return;
    }
    setSent({ phone, sentTo: r.data.sentTo, resendInSec: r.data.resendInSec });
  }

  async function setNew(e: FormEvent) {
    e.preventDefault();
    if (!sent) return;
    const found: Errs = {
      code: code.length === 6 ? undefined : d.errors.codeFormat,
      password: password.length >= 8 ? undefined : d.errors.passwordShort,
    };
    setErrs(found);
    setError(null);
    if (found.code || found.password) return;
    setBusy(true);
    const r = await customerApi.reset({ phone: sent.phone, code, password });
    setBusy(false);
    if (!r.ok) {
      setError(errorMessage(r, d.errors));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className={s.form}>
        <Notice kind="ok">{d.resetDone}</Notice>
        <Link className="btn btn-primary" href={href(lang, '/login')}>
          {d.backToLogin}
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <form className={s.form} method="post" onSubmit={setNew} noValidate>
        <p className={s.intro}>{fmt(d.resetCodeIntro, { phone: sent.sentTo })}</p>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <Field
          label={d.code}
          className={s.code}
          error={errs.code}
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          autoFocus
        />
        <PasswordField
          lang={lang}
          label={d.newPassword}
          hint={d.passwordHint}
          error={errs.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          name="password"
          autoComplete="new-password"
        />
        <div className={s.row}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? d.working : d.resetButton}
          </button>
          <button
            type="button"
            className={s.linkBtn}
            onClick={() => {
              setSent(null);
              setCode('');
              setError(null);
            }}
          >
            {d.changeNumber}
          </button>
        </div>
        <ResendRow
          lang={lang}
          phone={sent.phone}
          purpose="reset"
          initialSeconds={sent.resendInSec}
        />
      </form>
    );
  }

  return (
    <form className={s.form} method="post" onSubmit={sendCode} noValidate>
      <p className={s.intro}>{d.resetIntro}</p>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field
        label={d.phone}
        hint={d.phoneHint}
        error={errs.phone}
        value={phoneIn}
        onChange={(e) => setPhoneIn(e.target.value)}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? d.working : d.sendCode}
      </button>
    </form>
  );
}
