'use client';
import { toEnDigits } from '@bdc/i18n';
import Link from 'next/link';
import { useState } from 'react';
import { Field, Notice } from '~/features/account/Field';
import { call, normalizePhone } from '~/features/account/lib';
import { retryMinutes } from '~/features/checkout/errors';
import { etaText } from '~/features/checkout/eta';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { browserApi } from '~/lib/api-browser';
import { formatPrice, localizeDigits } from '~/lib/format';
import { formatDateTime } from './format';
import s from './orders.module.css';
import { Timeline } from './Timeline';
import type { OrderTrack } from './types';

/** Guest order tracking: order number + the phone it was placed with. Shows the status timeline only. */
export function TrackForm({
  lang,
  initialOrderNo = '',
  loggedIn = false,
}: {
  lang: Lang;
  initialOrderNo?: string;
  loggedIn?: boolean;
}) {
  const d = dict(lang).orders;
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ orderNo?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrack | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const no = toEnDigits(orderNo).trim().toUpperCase();
    const p = normalizePhone(phone);
    const err: typeof errors = {};
    if (no.length < 3) err.orderNo = d.trackOrderNoRequired;
    if (!p) err.phone = d.trackPhoneRequired;
    setErrors(err);
    setProblem(null);
    if (!p || err.orderNo) return;

    setBusy(true);
    const r = await call<OrderTrack>(
      browserApi.POST('/v1/public/track', { body: { orderNo: no, phone: p } }),
    );
    setBusy(false);
    if (r.ok) {
      setResult(r.data);
      return;
    }
    if (r.status === 404) setProblem(d.trackNotFound);
    else if (r.status === 429) {
      setProblem(
        r.retryAfterSec
          ? fmt(d.trackTooManyIn, { m: localizeDigits(retryMinutes(r.retryAfterSec), lang) })
          : d.trackTooMany,
      );
    } else setProblem(d.trackError);
  }

  if (result) {
    const t = result;
    return (
      <div className={s.trackWrap}>
        <h1 className="page-title">{fmt(d.orderTitle, { no: localizeDigits(t.orderNo, lang) })}</h1>
        <section className={s.card} aria-labelledby="tr-status">
          <div className={s.detailHead}>
            <h2 id="tr-status" className={s.cardTitle}>
              {d.timeline}
            </h2>
            <span className={`${s.badge} ${s[`st_${t.status}`] ?? ''}`}>{d.status[t.status]}</span>
          </div>
          <Timeline lang={lang} steps={t.timeline} />
          {t.status === 'processing' ? (
            <p className={s.muted}>
              {fmt(d.eta, { range: etaText(lang, t.etaMinDays, t.etaMaxDays) })}
            </p>
          ) : null}
        </section>
        <dl className={s.trackFacts}>
          <div className={s.row}>
            <dt>{d.trackPlaced}</dt>
            <dd>{formatDateTime(t.placedAt, lang)}</dd>
          </div>
          <div className={s.row}>
            <dt>{d.trackItems}</dt>
            <dd>{localizeDigits(t.itemCount, lang)}</dd>
          </div>
          <div className={s.row}>
            <dt>{d.trackTotal}</dt>
            <dd>{formatPrice(t.grandTotalP, lang)}</dd>
          </div>
        </dl>
        <p className={s.muted}>{fmt(d.trackPhoneOn, { phone: t.maskedPhone })}</p>
        <div className={s.formActions}>
          <button type="button" className="btn btn-ghost" onClick={() => setResult(null)}>
            {d.trackAgain}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.trackWrap}>
      <h1 className="page-title">{d.trackTitle}</h1>
      <p className={s.muted}>{d.trackIntro}</p>
      <form className={s.form} onSubmit={submit} noValidate>
        <Field
          label={d.trackOrderNo}
          hint={d.trackOrderNoHint}
          autoComplete="off"
          autoCapitalize="characters"
          value={orderNo}
          error={errors.orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
        />
        <Field
          label={d.trackPhone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          error={errors.phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {problem ? <Notice kind="error">{problem}</Notice> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? d.trackSearching : d.trackButton}
        </button>
      </form>
      {loggedIn ? null : (
        <p className={s.muted}>
          {d.trackLoginHint}{' '}
          <Link className="link" href={href(lang, '/login')}>
            {d.trackLogin}
          </Link>
        </p>
      )}
    </div>
  );
}
