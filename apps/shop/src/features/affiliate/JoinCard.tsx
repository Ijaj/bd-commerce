'use client';
import { useState } from 'react';
import { Field, Notice } from '~/features/account/Field';
import { call } from '~/features/account/lib';
import { dict, fmt, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import { formatNumber, formatPrice } from '~/lib/format';
import s from './affiliate.module.css';
import { bpToPercent } from './logic';
import type { AffiliateMe } from './types';

function validUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Join form + programme rules. `info` carries whatever the API says about the programme before joining. */
export function JoinCard({
  lang,
  info,
  onJoined,
}: {
  lang: Lang;
  info: AffiliateMe;
  onJoined: (me: AffiliateMe) => void;
}) {
  const t = dict(lang).affiliate.join;
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(info.programEnabled === false);
  const [errors, setErrors] = useState<{ name?: string; site?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const rules = [
    info.commissionBp != null
      ? fmt(t.ruleRate, { rate: formatNumber(Number(bpToPercent(info.commissionBp)), lang, 1) })
      : t.ruleRateGeneric,
    t.ruleApproval,
    info.minPayoutP != null ? fmt(t.ruleMin, { amt: formatPrice(info.minPayoutP, lang) }) : null,
    fmt(t.ruleWindow, { days: formatNumber(info.clickWindowDays ?? 30, lang, 0) }),
    t.ruleCode,
    t.ruleSelf,
  ].filter((x): x is string => x !== null);

  if (off) {
    return (
      <section className={s.card} aria-labelledby="af-off">
        <h2 id="af-off">{t.offTitle}</h2>
        <p>{t.offBody}</p>
      </section>
    );
  }

  async function submit() {
    if (busy) return;
    const next: typeof errors = {};
    const n = name.trim();
    const w = site.trim();
    const c = code.trim().toUpperCase();
    if (n.length < 2 || n.length > 80) next.name = t.errors.validation;
    if (w && !validUrl(w)) next.site = t.errors.validation;
    if (c && !/^[A-Z0-9]{4,16}$/.test(c)) next.code = t.errors.AFFILIATE_CODE_INVALID;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    const r = await call(
      browserApi.POST('/v1/customer/affiliate/join', {
        body: { displayName: n, ...(w ? { website: w } : {}), ...(c ? { code: c } : {}) },
      }),
    );
    setBusy(false);
    if (r.ok) {
      onJoined(r.data);
      return;
    }
    if (r.code === 'AFFILIATE_PROGRAM_OFF') {
      setOff(true);
      return;
    }
    if (r.code === 'AFFILIATE_CODE_TAKEN' || r.code === 'AFFILIATE_CODE_INVALID') {
      setErrors({ code: t.errors[r.code] });
      return;
    }
    if (r.code === 'AFFILIATE_ALREADY_JOINED') {
      setFormError(t.errors.AFFILIATE_ALREADY_JOINED);
      return;
    }
    setFormError(
      r.code === 'NETWORK'
        ? t.errors.network
        : r.status === 400
          ? t.errors.validation
          : t.errors.generic,
    );
  }

  return (
    <div className={s.two}>
      <section className={s.card} aria-labelledby="af-join">
        <h2 id="af-join">{t.title}</h2>
        <p className={s.muted}>{t.intro}</p>
        <form
          className={s.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field
            label={t.displayName}
            hint={t.displayNameHint}
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Field
            label={t.website}
            hint={t.websiteHint}
            type="url"
            inputMode="url"
            value={site}
            autoComplete="off"
            placeholder="https://"
            onChange={(e) => setSite(e.target.value)}
            error={errors.site}
          />
          <Field
            label={t.code}
            hint={t.codeHint}
            value={code}
            maxLength={16}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />
          {formError ? <Notice kind="error">{formError}</Notice> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t.submitting : t.submit}
          </button>
        </form>
      </section>
      <section className={s.card} aria-labelledby="af-rules">
        <h2 id="af-rules">{t.rulesTitle}</h2>
        <ul className={s.rules}>
          {rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
