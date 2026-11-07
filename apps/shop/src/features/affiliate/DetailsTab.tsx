'use client';
import { useState } from 'react';
import { Field, Notice } from '~/features/account/Field';
import { call } from '~/features/account/lib';
import { dict, fmt, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import { formatNumber } from '~/lib/format';
import s from './affiliate.module.css';
import { bpToPercent, type PayoutErrors, type PayoutFormValues, payoutBody } from './logic';
import type { AffiliateMe } from './types';

const EMPTY: PayoutFormValues = {
  method: 'bkash',
  bkashNumber: '',
  holderName: '',
  bankName: '',
  branch: '',
  accountNo: '',
  accountName: '',
};

export function DetailsTab({
  lang,
  me,
  onChange,
}: {
  lang: Lang;
  me: AffiliateMe;
  onChange: (m: AffiliateMe) => void;
}) {
  const t = dict(lang).affiliate.details;
  // The API never returns full numbers, so the form always starts empty (replace, not edit).
  const [v, setV] = useState<PayoutFormValues>({ ...EMPTY, method: me.payoutMethod ?? 'bkash' });
  const [errors, setErrors] = useState<PayoutErrors>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const set = (k: keyof PayoutFormValues) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const err = (k: keyof PayoutFormValues) => (errors[k] ? t.invalid : null);

  async function submit() {
    if (busy) return;
    const r = payoutBody(v);
    if (!r.ok) {
      setErrors(r.errors);
      setMsg({ kind: 'error', text: t.invalid });
      return;
    }
    setErrors({});
    setMsg(null);
    setBusy(true);
    const res = await call(
      browserApi.PUT('/v1/customer/affiliate/payout-details', { body: r.body }),
    );
    setBusy(false);
    if (!res.ok) {
      setMsg({
        kind: 'error',
        text:
          res.code === 'NETWORK'
            ? t.errors.network
            : res.status === 400
              ? t.invalid
              : t.errors.generic,
      });
      return;
    }
    setV({ ...EMPTY, method: v.method });
    setMsg({ kind: 'ok', text: t.done });
    onChange(res.data);
  }

  const bkash = v.method === 'bkash';
  return (
    <div className={s.two}>
      <section className={s.card} aria-labelledby="af-pd">
        <h2 id="af-pd">{t.title}</h2>
        <p className={s.muted}>
          {me.payoutDetailsMasked
            ? `${t.saved}: ${me.payoutMethod === 'bank' ? t.bank : t.bkash} ${me.payoutDetailsMasked}. ${t.replaceHint}`
            : t.none}
        </p>
        <form
          className={s.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            <legend className="sr-only">{t.methodLabel}</legend>
            {(['bkash', 'bank'] as const).map((m) => (
              <label key={m} className={s.opt}>
                <input
                  type="radio"
                  name="payout-method"
                  value={m}
                  checked={v.method === m}
                  onChange={() => setV((p) => ({ ...p, method: m }))}
                />
                <span className={s.optText}>
                  <span>{m === 'bkash' ? t.bkash : t.bank}</span>
                  <span className={s.muted}>{m === 'bkash' ? t.bkashHint : t.bankHint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {bkash ? (
            <div className={s.grid}>
              <Field
                label={t.bkashNumber}
                inputMode="tel"
                autoComplete="off"
                placeholder="01XXXXXXXXX"
                value={v.bkashNumber}
                onChange={set('bkashNumber')}
                error={err('bkashNumber')}
              />
              <Field
                label={t.holderName}
                autoComplete="off"
                value={v.holderName}
                onChange={set('holderName')}
                error={err('holderName')}
              />
            </div>
          ) : (
            <div className={s.grid}>
              <Field
                label={t.bankName}
                autoComplete="off"
                value={v.bankName}
                onChange={set('bankName')}
                error={err('bankName')}
              />
              <Field
                label={t.branch}
                autoComplete="off"
                value={v.branch}
                onChange={set('branch')}
                error={err('branch')}
              />
              <Field
                label={t.accountName}
                autoComplete="off"
                value={v.accountName}
                onChange={set('accountName')}
                error={err('accountName')}
              />
              <Field
                label={t.accountNo}
                inputMode="numeric"
                autoComplete="off"
                value={v.accountNo}
                onChange={set('accountNo')}
                error={err('accountNo')}
              />
            </div>
          )}
          {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t.saving : t.save}
          </button>
        </form>
      </section>
      <section className={s.card} aria-labelledby="af-prof">
        <h2 id="af-prof">{t.profileTitle}</h2>
        <dl className={s.kv}>
          <dt>{t.profileName}</dt>
          <dd>{me.displayName}</dd>
          {me.website ? (
            <>
              <dt>{t.profileSite}</dt>
              <dd>{me.website}</dd>
            </>
          ) : null}
          <dt>{t.profileCode}</dt>
          <dd>
            <span className={s.code}>{me.code}</span>
          </dd>
          <dt>{t.profileRate}</dt>
          <dd>
            {fmt(t.profileRateValue, {
              rate: formatNumber(Number(bpToPercent(me.commissionBp ?? 0)), lang, 1),
            })}
          </dd>
        </dl>
      </section>
    </div>
  );
}
