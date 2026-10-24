'use client';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import type { Me } from '~/lib/types';
import s from './account.module.css';
import { customerApi } from './api';
import { Field, Notice } from './Field';
import { errorMessage, isEmail } from './lib';
import { setSessionMe } from './session';

/** Name, email and preferred language. The phone is verified at signup and shown read-only. */
export function ProfileForm({ lang, me }: { lang: Lang; me: Me }) {
  const d = dict(lang).account;
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email ?? '');
  const [pref, setPref] = useState<'en' | 'bn'>(me.lang);
  const [errs, setErrs] = useState<{ name?: string; email?: string }>({});
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = {
      name: name.trim() ? undefined : d.errors.nameRequired,
      email: !email.trim() || isEmail(email) ? undefined : d.errors.emailInvalid,
    };
    setErrs(found);
    setMsg(null);
    if (found.name || found.email) return;

    setBusy(true);
    const r = await customerApi.updateMe({
      name: name.trim(),
      email: email.trim() ? email.trim() : null,
      lang: pref,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg({ kind: 'error', text: errorMessage(r, d.errors) });
      return;
    }
    setSessionMe(r.data);
    setMsg({ kind: 'ok', text: d.saved });
    // Saving a different language takes you to the account page in that language.
    if (pref !== lang) router.push(href(pref, '/account'));
    else router.refresh();
  }

  return (
    <form className={s.form} method="post" onSubmit={submit} noValidate>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <Field
        label={d.name}
        error={errs.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        name="name"
        autoComplete="name"
      />
      <Field label={d.phoneLocked} value={me.phone ?? ''} readOnly disabled name="phone" />
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
      <div className={s.field}>
        <label className={s.label} htmlFor="pref-lang">
          {d.languagePref}
        </label>
        <select
          id="pref-lang"
          className="input"
          value={pref}
          onChange={(e) => setPref(e.target.value === 'bn' ? 'bn' : 'en')}
        >
          <option value="en">{d.langEn}</option>
          <option value="bn">{d.langBn}</option>
        </select>
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? d.working : d.saveProfile}
        </button>
      </div>
    </form>
  );
}
