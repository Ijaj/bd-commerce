'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Img } from '~/components/Img';
import { Notice } from '~/features/account/Field';
import { type ApiFail, call } from '~/features/account/lib';
import { dict, fmt, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { browserApi } from '~/lib/api-browser';
import { localizeDigits } from '~/lib/format';
import { buildReturnBody, type DraftLine, REASONS, returnableLines } from './logic';
import s from './returns.module.css';
import type { OrderForReturn, ReturnReason } from './types';

/** Messages by API error code; unknown codes fall back by HTTP status. */
export function returnErrorMessage(e: ApiFail, errors: Record<string, string>): string {
  if (e.code === 'NETWORK') return errors.network ?? '';
  if (e.code && errors[e.code]) return errors[e.code] ?? '';
  if (e.status === 400) return errors.validation ?? '';
  return errors.generic ?? '';
}

/** Customer return request: pick lines + qty, a reason per line. The API decides eligibility, we surface its error. */
export function ReturnForm({ lang, order }: { lang: Lang; order: OrderForReturn }) {
  const d = dict(lang).returns;
  const router = useRouter();
  const lines = returnableLines(order);
  const [draft, setDraft] = useState<Record<string, DraftLine>>(() =>
    Object.fromEntries(
      lines.map((it) => [
        it.orderItemId,
        { checked: false, qty: 1, reason: 'defective' as ReturnReason, note: '' },
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (lines.length === 0) return <Notice kind="error">{d.nothingReturnable}</Notice>;

  function patch(id: string, p: Partial<DraftLine>) {
    setDraft((cur) => ({ ...cur, [id]: { ...(cur[id] as DraftLine), ...p } }));
    setProblem(null);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const body = buildReturnBody(order.orderNo, draft);
    if (body.items.length === 0) {
      setProblem(d.pickOne);
      return;
    }
    setBusy(true);
    const r = await call(browserApi.POST('/v1/customer/returns', { body }));
    setBusy(false);
    if (!r.ok) {
      setProblem(returnErrorMessage(r, d.errors));
      return;
    }
    router.push(href(lang, `/account/returns/${r.data.returnNo}`));
    router.refresh();
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <p className={s.muted}>{d.formIntro}</p>
      <ul className={s.lines}>
        {lines.map((it) => {
          const l = draft[it.orderItemId] as DraftLine;
          const max = it.returnableQty ?? 0;
          const cid = `ret-${it.orderItemId}`;
          return (
            <li key={it.orderItemId} className={s.line}>
              <label className={s.lineHead} htmlFor={cid}>
                <input
                  id={cid}
                  type="checkbox"
                  checked={l.checked}
                  onChange={(e) => patch(it.orderItemId, { checked: e.target.checked })}
                />
                <span className={s.thumb} aria-hidden="true">
                  <Img image={it.image} sizes="56px" alt="" />
                </span>
                <span className={s.lineText}>
                  <span>{fmt(d.chooseItem, { title: it.title })}</span>
                  {it.optionsText ? <span className={s.muted}>{it.optionsText}</span> : null}
                </span>
              </label>
              {l.checked ? (
                <div className={s.lineFields}>
                  <div className={s.field}>
                    <label htmlFor={`${cid}-q`}>{d.qty}</label>
                    <input
                      id={`${cid}-q`}
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={max}
                      value={l.qty}
                      onChange={(e) =>
                        patch(it.orderItemId, {
                          qty: Math.min(max, Math.max(1, Number.parseInt(e.target.value, 10) || 1)),
                        })
                      }
                    />
                    <span className={s.muted}>
                      {fmt(d.maxQty, { n: localizeDigits(max, lang) })}
                    </span>
                  </div>
                  <div className={s.field}>
                    <label htmlFor={`${cid}-r`}>{d.reasonLabel}</label>
                    <select
                      id={`${cid}-r`}
                      className="input"
                      value={l.reason}
                      onChange={(e) =>
                        patch(it.orderItemId, { reason: e.target.value as ReturnReason })
                      }
                    >
                      {REASONS.map((r) => (
                        <option key={r} value={r}>
                          {d.reasons[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`${s.field} ${s.wide}`}>
                    <label htmlFor={`${cid}-n`}>{d.noteLabel}</label>
                    <input
                      id={`${cid}-n`}
                      className="input"
                      maxLength={500}
                      placeholder={d.notePlaceholder}
                      value={l.note}
                      onChange={(e) => patch(it.orderItemId, { note: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {problem ? <Notice kind="error">{problem}</Notice> : null}
      <div className={s.actions}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? d.sending : d.submit}
        </button>
      </div>
    </form>
  );
}
