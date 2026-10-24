'use client';
import { type FormEvent, useState } from 'react';
import { dict, type Lang } from '~/i18n';
import s from './account.module.css';
import { customerApi } from './api';
import { Notice, PasswordField } from './Field';
import { errorMessage } from './lib';

export function PasswordForm({ lang }: { lang: Lang }) {
  const d = dict(lang).account;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errs, setErrs] = useState<{ current?: string; next?: string }>({});
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = {
      current: current ? undefined : d.errors.passwordRequired,
      next: next.length >= 8 ? undefined : d.errors.passwordShort,
    };
    setErrs(found);
    setMsg(null);
    if (found.current || found.next) return;

    setBusy(true);
    const r = await customerApi.changePassword(current, next);
    setBusy(false);
    if (!r.ok) {
      // INVALID_CREDENTIALS here means the current password was wrong.
      setMsg({
        kind: 'error',
        text: errorMessage(r, d.errors, { INVALID_CREDENTIALS: 'WRONG_PASSWORD' }),
      });
      return;
    }
    setCurrent('');
    setNext('');
    setMsg({ kind: 'ok', text: d.passwordChanged });
  }

  return (
    <form className={s.form} method="post" onSubmit={submit} noValidate>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <PasswordField
        lang={lang}
        label={d.currentPassword}
        error={errs.current}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        name="currentPassword"
        autoComplete="current-password"
      />
      <PasswordField
        lang={lang}
        label={d.newPassword}
        hint={d.passwordHint}
        error={errs.next}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        name="newPassword"
        autoComplete="new-password"
      />
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? d.working : d.changePassword}
        </button>
      </div>
    </form>
  );
}
