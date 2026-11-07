'use client';
import { useEffect, useState } from 'react';
import { Field, Notice } from '~/features/account/Field';
import { dict, fmt, type Lang } from '~/i18n';
import { formatNumber } from '~/lib/format';
import s from './affiliate.module.css';
import { buildLink } from './logic';
import type { AffiliateMe } from './types';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function LinksTab({ lang, me }: { lang: Lang; me: AffiliateMe }) {
  const t = dict(lang).affiliate.links;
  const code = me.code ?? '';
  const [origin, setOrigin] = useState('');
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const link = origin ? buildLink(input, origin, code) : null;
  const invalid = origin !== '' && input.trim() !== '' && link === null;

  async function copy(text: string) {
    const ok = await copyText(text);
    setMsg(ok ? { kind: 'ok', text: t.copied } : { kind: 'error', text: t.copyFailed });
  }

  return (
    <div className={s.two}>
      <section className={s.card} aria-labelledby="af-gen">
        <h2 id="af-gen">{t.generatorTitle}</h2>
        <Field
          label={t.urlLabel}
          hint={t.urlHint}
          value={input}
          placeholder="/p/..."
          autoComplete="off"
          spellCheck={false}
          error={invalid ? t.invalid : null}
          onChange={(e) => {
            setInput(e.target.value);
            setMsg(null);
          }}
        />
        <div>
          <label className="sr-only" htmlFor="af-out">
            {t.outLabel}
          </label>
          <div className={s.muted}>{t.outLabel}</div>
          <div className={s.linkRow}>
            <input
              id="af-out"
              className="input"
              readOnly
              value={link ?? ''}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!link}
              onClick={() => link && void copy(link)}
            >
              {t.copy}
            </button>
          </div>
          {link ? (
            <span className={s.muted}>
              {fmt(t.includes, {
                code,
                days: formatNumber(me.clickWindowDays ?? 30, lang, 0),
              })}
            </span>
          ) : null}
        </div>
        {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      </section>
      <section className={s.card} aria-labelledby="af-code">
        <h2 id="af-code">{t.codeTitle}</h2>
        <div>
          <span className={s.code}>{code}</span>
        </div>
        <p className={s.muted}>{t.codeBody}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy(code)}>
          {t.copyCode}
        </button>
      </section>
    </div>
  );
}
