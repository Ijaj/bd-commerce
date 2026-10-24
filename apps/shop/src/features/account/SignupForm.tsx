'use client';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { dict, fmt, type Lang } from '~/i18n';
import s from './account.module.css';
import { customerApi } from './api';
import { Field, Notice, PasswordField } from './Field';
import { cleanCode, errorMessage, isEmail, normalizePhone } from './lib';
import { ResendRow } from './ResendRow';
import { setSessionMe } from './session';
import { resetWishlist } from './wishlist-store';

type Errs = Partial<Record<'name' | 'phone' | 'email' | 'password' | 'code', string>>;

/** Two steps: details -> SMS code. The account is created only when the code is confirmed. */
export function SignupForm({ lang, next }: { lang: Lang; next: string }) {
  const d = dict(lang).account;
  const router = useRouter();
  const [name, setName] = useState('');
  const [phoneIn, setPhoneIn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ phone: string; sentTo: string; resendInSec: number } | null>(
    null,
  );
  const [errs, setErrs] = useState<Errs>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const phone = normalizePhone(phoneIn);
    const found: Errs = {
      name: name.trim() ? undefined : d.errors.nameRequired,
      phone: phone ? undefined : d.errors.phoneInvalid,
      email: !email.trim() || isEmail(email) ? undefined : d.errors.emailInvalid,
      password: password.length >= 8 ? undefined : d.errors.passwordShort,
    };
    setErrs(found);
    setError(null);
    if (!phone || found.name || found.email || found.password) return;

    setBusy(true);
    const r = await customerApi.requestOtp(phone, 'signup');
    setBusy(false);
    if (!r.ok) {
      setError(errorMessage(r, d.errors));
      return;
    }
    setSent({ phone, sentTo: r.data.sentTo, resendInSec: r.data.resendInSec });
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!sent) return;
    setError(null);
    if (code.length !== 6) {
      setErrs({ code: d.errors.codeFormat });
      return;
    }
    setErrs({});
    setBusy(true);
    const r = await customerApi.signup({
      name: name.trim(),
      phone: sent.phone,
      email: email.trim() || undefined,
      password,
      code,
    });
    if (!r.ok) {
      setBusy(false);
      setError(errorMessage(r, d.errors));
      return;
    }
    resetWishlist();
    setSessionMe(r.data.customer);
    router.replace(next);
    router.refresh();
  }

  if (sent) {
    return (
      <form className={s.form} method="post" onSubmit={confirm} noValidate>
        <h2 className="sr-only">{d.codeTitle}</h2>
        <p className={s.intro}>{fmt(d.codeSent, { phone: sent.sentTo })}</p>
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
          // the code box is the only thing on this step; focusing it saves a tap
          autoFocus
        />
        <div className={s.row}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? d.working : d.createButton}
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
          purpose="signup"
          initialSeconds={sent.resendInSec}
        />
      </form>
    );
  }

  return (
    <form className={s.form} method="post" onSubmit={sendCode} noValidate>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field
        label={d.name}
        error={errs.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        name="name"
        autoComplete="name"
      />
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
      <Field
        label={d.email}
        error={errs.email}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
      />
      <PasswordField
        lang={lang}
        label={d.password}
        hint={d.passwordHint}
        error={errs.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        name="password"
        autoComplete="new-password"
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? d.working : d.sendCode}
      </button>
    </form>
  );
}
