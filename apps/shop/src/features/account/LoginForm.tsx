'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import s from './account.module.css';
import { customerApi } from './api';
import { Field, Notice, PasswordField } from './Field';
import { errorMessage, normalizePhone } from './lib';
import { setSessionMe } from './session';
import { resetWishlist } from './wishlist-store';

export function LoginForm({ lang, next }: { lang: Lang; next: string }) {
  const d = dict(lang).account;
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState<{ login?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const id = login.trim();
    const next_ = {
      login: id ? undefined : d.errors.loginRequired,
      password: password ? undefined : d.errors.passwordRequired,
    };
    setErrs(next_);
    setError(null);
    if (next_.login || next_.password) return;

    setBusy(true);
    // A phone typed with Bangla digits / +880 is sent normalised; emails go as typed.
    const r = await customerApi.login(id.includes('@') ? id : (normalizePhone(id) ?? id), password);
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

  return (
    <form className={s.form} method="post" onSubmit={submit} noValidate>
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Field
        label={d.loginId}
        hint={d.loginIdHint}
        error={errs.login}
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        name="login"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
      />
      <PasswordField
        lang={lang}
        label={d.password}
        error={errs.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        name="password"
        autoComplete="current-password"
      />
      <div className={s.row}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? d.working : d.loginButton}
        </button>
        <Link className="link" href={href(lang, '/reset')}>
          {d.forgot}
        </Link>
      </div>
    </form>
  );
}
