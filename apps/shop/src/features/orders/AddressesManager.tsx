'use client';
import { useCallback, useState } from 'react';
import { Notice } from '~/features/account/Field';
import { call } from '~/features/account/lib';
import { AddressFields } from '~/features/checkout/AddressFields';
import {
  type AddressErrors,
  type AddressValue,
  addressBody,
  EMPTY_ADDRESS,
  validateAddress,
} from '~/features/checkout/address';
import type { Address } from '~/features/checkout/types';
import { dict, type Lang } from '~/i18n';
import { browserApi } from '~/lib/api-browser';
import s from './orders.module.css';

const MAX = 10;

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'edit'; id: string };

function toValue(a: Address): AddressValue {
  return {
    name: a.name,
    phone: a.phone,
    divisionId: null,
    districtId: a.districtId,
    upazilaId: a.upazilaId,
    line: a.line,
    landmark: a.landmark ?? '',
    label: a.label ?? '',
  };
}

/** Saved addresses (max 10): add, edit, delete, set default. The list is re-read after every change. */
export function AddressesManager({
  lang,
  initial,
  customerName,
  customerPhone,
}: {
  lang: Lang;
  initial: Address[];
  customerName: string;
  customerPhone: string;
}) {
  const d = dict(lang).orders;
  const check = dict(lang).checkout;
  const [list, setList] = useState(initial);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [value, setValue] = useState<AddressValue>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const patch = useCallback((p: Partial<AddressValue>) => {
    setValue((v) => ({ ...v, ...p }));
    setErrors({});
  }, []);

  function fail(r: { status: number; code: string | null }) {
    const e = d.addrErrors as Record<string, string>;
    setProblem(
      (r.code === 'NETWORK' ? e.network : r.code && e[r.code]) ||
        (r.status === 400 ? e.validation : e.generic) ||
        e.generic ||
        '',
    );
  }

  async function reload() {
    const r = await call<Address[]>(browserApi.GET('/v1/customer/addresses'));
    if (r.ok) setList(r.data);
  }

  function open(next: Mode, from?: Address) {
    setProblem(null);
    setErrors({});
    setMakeDefault(false);
    setValue(from ? toValue(from) : { ...EMPTY_ADDRESS, name: customerName, phone: customerPhone });
    setMode(next);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const err = validateAddress(value, check.errors, true);
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    setBusy('save');
    setProblem(null);
    const body = { ...addressBody(value), label: value.label.trim() || null };
    const r =
      mode.kind === 'edit'
        ? await call(
            browserApi.PATCH('/v1/customer/addresses/{id}', {
              params: { path: { id: mode.id } },
              body,
            }),
          )
        : await call(
            browserApi.POST('/v1/customer/addresses', {
              body: { ...body, isDefault: makeDefault },
            }),
          );
    if (!r.ok) {
      setBusy(null);
      fail(r);
      return;
    }
    await reload();
    setBusy(null);
    setMode({ kind: 'list' });
  }

  async function setDefault(id: string) {
    setBusy(id);
    setProblem(null);
    const r = await call(
      browserApi.PUT('/v1/customer/addresses/{id}/default', { params: { path: { id } } }),
    );
    if (r.ok) await reload();
    else fail(r);
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    setProblem(null);
    const r = await call(
      browserApi.DELETE('/v1/customer/addresses/{id}', { params: { path: { id } } }),
    );
    if (r.ok) await reload();
    else fail(r);
    setConfirmDelete(null);
    setBusy(null);
  }

  if (mode.kind !== 'list') {
    return (
      <form className={s.formCard} onSubmit={save} noValidate>
        <h2 className={s.cardTitle}>{mode.kind === 'new' ? d.addrNewTitle : d.addrEditTitle}</h2>
        <AddressFields
          lang={lang}
          value={value}
          errors={errors}
          onChange={patch}
          contact
          withLabel
        />
        {mode.kind === 'new' ? (
          <label className={s.checkRow}>
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
            />
            {d.addrIsDefault}
          </label>
        ) : null}
        {problem ? <Notice kind="error">{problem}</Notice> : null}
        <div className={s.formActions}>
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            {busy === 'save' ? d.addrSaving : d.addrSave}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setMode({ kind: 'list' })}>
            {d.addrCancel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className={s.topRow}>
        <p className={s.muted}>{d.addrIntro}</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={list.length >= MAX}
          onClick={() => open({ kind: 'new' })}
        >
          {d.addrAdd}
        </button>
      </div>
      {list.length >= MAX ? <p className={s.muted}>{d.addrLimit}</p> : null}
      {problem ? <Notice kind="error">{problem}</Notice> : null}
      {list.length === 0 ? (
        <p className={s.muted}>{d.addrEmpty}</p>
      ) : (
        <ul className={s.addrGrid}>
          {list.map((a) => (
            <li key={a.id} className={`${s.addrCard} ${a.isDefault ? s.isDefault : ''}`}>
              <span>
                {a.label ? `${a.label} · ` : ''}
                {a.name}
                {a.isDefault ? <span className={s.badge}> {d.addrDefault}</span> : null}
              </span>
              <span className={s.muted}>{a.phone}</span>
              <span>
                {a.line}, {lang === 'bn' && a.placeTextBn ? a.placeTextBn : a.placeText}
              </span>
              {a.landmark ? <span className={s.muted}>{a.landmark}</span> : null}
              <div className={s.addrActions}>
                <button
                  type="button"
                  className={s.linkBtn}
                  disabled={busy !== null}
                  onClick={() => open({ kind: 'edit', id: a.id }, a)}
                >
                  {d.addrEdit}
                </button>
                {a.isDefault ? null : (
                  <button
                    type="button"
                    className={s.linkBtn}
                    disabled={busy !== null}
                    onClick={() => setDefault(a.id)}
                  >
                    {d.addrMakeDefault}
                  </button>
                )}
                {confirmDelete === a.id ? (
                  <>
                    <span className={s.muted}>{d.addrConfirmDelete}</span>
                    <button
                      type="button"
                      className={`${s.linkBtn} ${s.dangerBtn}`}
                      disabled={busy !== null}
                      onClick={() => remove(a.id)}
                    >
                      {d.addrYesDelete}
                    </button>
                    <button
                      type="button"
                      className={s.linkBtn}
                      onClick={() => setConfirmDelete(null)}
                    >
                      {d.addrCancel}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${s.linkBtn} ${s.dangerBtn}`}
                    disabled={busy !== null}
                    onClick={() => setConfirmDelete(a.id)}
                  >
                    {d.addrDelete}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
