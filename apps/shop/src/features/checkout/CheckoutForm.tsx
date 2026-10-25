'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '~/components/States';
import { Field, Notice } from '~/features/account/Field';
import { call, isEmail, normalizePhone } from '~/features/account/lib';
import { clearLocalCart, setCart, useCart } from '~/features/cart/store';
import type { Cart } from '~/features/cart/types';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { browserApi } from '~/lib/api-browser';
import type { Me } from '~/lib/types';
import { AddressFields } from './AddressFields';
import {
  type AddressErrors,
  type AddressValue,
  addressBody,
  EMPTY_ADDRESS,
  validateAddress,
} from './address';
import s from './checkout.module.css';
import { cartNoticeFor, checkoutError, rememberPlaced } from './errors';
import { OtpBlock } from './OtpBlock';
import { Summary } from './Summary';
import type { Address, Quote } from './types';

type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; quote: Quote }
  | { status: 'error'; message: string };

type GuestErrors = Partial<Record<'name' | 'phone' | 'email', string>>;

const NEW = 'new';

/**
 * Checkout (COD only in P1). Logged-in customers pick a saved address or add one; guests give
 * name + phone (+ email) and an address. The delivery quote refreshes whenever the location
 * changes, and the idempotency key is generated once per page load so a double tap or a retry
 * after a flaky network can never create two orders.
 */
export function CheckoutForm({
  lang,
  initialCart,
  me,
  addresses,
}: {
  lang: Lang;
  initialCart: Cart | null;
  me: Me | null;
  addresses: Address[];
}) {
  const d = dict(lang).checkout;
  const router = useRouter();
  const live = useCart();
  const cart = live ?? initialCart;
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const [choice, setChoice] = useState<string>(defaultAddress?.id ?? NEW);
  const [guest, setGuest] = useState({ name: '', phone: '', email: '' });
  const [guestErrors, setGuestErrors] = useState<GuestErrors>({});
  const [newAddr, setNewAddr] = useState<AddressValue>({
    ...EMPTY_ADDRESS,
    name: me?.name ?? '',
    phone: me?.phone ?? '',
  });
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [saveNew, setSaveNew] = useState(true);
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCart) setCart(initialCart);
  }, [initialCart]);

  const patchAddr = useCallback((p: Partial<AddressValue>) => {
    setNewAddr((v) => ({ ...v, ...p }));
    setAddrErrors({});
  }, []);

  const saved = choice === NEW ? null : (addresses.find((a) => a.id === choice) ?? null);
  const loc = saved
    ? { districtId: saved.districtId, upazilaId: saved.upazilaId, areaId: saved.areaId }
    : newAddr.districtId !== null && newAddr.upazilaId !== null
      ? { districtId: newAddr.districtId, upazilaId: newAddr.upazilaId, areaId: null }
      : null;
  const locKey = loc ? `${loc.districtId}:${loc.upazilaId}:${loc.areaId ?? ''}` : '';
  const cartKey = cart ? `${cart.count}:${cart.subtotalP}` : '';

  // Live quote. `latest` drops answers that arrive after the location changed again.
  const latest = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: locKey/cartKey encode `loc`/`cart`
  useEffect(() => {
    const n = ++latest.current;
    if (!loc || !cart || cart.items.length === 0) {
      setQuote({ status: 'idle' });
      return;
    }
    setQuote({ status: 'loading' });
    void call<Quote>(browserApi.POST('/v1/checkout/quote', { body: loc })).then((r) => {
      if (n !== latest.current) return;
      setQuote(
        r.ok
          ? { status: 'ok', quote: r.data }
          : { status: 'error', message: checkoutError(r, d.errors, lang) },
      );
    });
  }, [locKey, cartKey]);

  if (!cart) return null;
  if (cart.items.length === 0) {
    return (
      <div className="wrap page">
        <h1 className="page-title">{d.title}</h1>
        <EmptyState
          lang={lang}
          title={d.emptyTitle}
          body={d.emptyBody}
          action={
            <Link className="btn btn-primary" href={href(lang, '/')}>
              {d.toShop}
            </Link>
          }
        />
      </div>
    );
  }

  const q = quote.status === 'ok' ? quote.quote : null;
  const cartBlocked = cart.items.some((l) => l.problem !== null);
  const quoteProblem = q?.problems[0] ?? null;
  const blocked = cartBlocked || quoteProblem !== null || quote.status === 'error';
  const otpPhone = me ? me.phone : normalizePhone(guest.phone);

  function fail(text: string) {
    setFormError(text);
    queueMicrotask(() => errorRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setLimitHit(false);

    const gErr: GuestErrors = {};
    if (!me) {
      if (!guest.name.trim()) gErr.name = d.errors.nameRequired;
      if (!normalizePhone(guest.phone)) gErr.phone = d.errors.phoneInvalid;
      if (guest.email.trim() && !isEmail(guest.email)) gErr.email = d.errors.emailInvalid;
    }
    const aErr = choice === NEW ? validateAddress(newAddr, d.errors, me !== null) : {};
    setGuestErrors(gErr);
    setAddrErrors(aErr);
    if (Object.keys(gErr).length > 0 || Object.keys(aErr).length > 0) {
      fail(d.fixErrors);
      return;
    }
    if (blocked || !q) {
      fail(quote.status === 'error' ? quote.message : d.errors.addressRequired);
      return;
    }
    if (q.guestOtpRequired && code.length !== 6) {
      setCodeError(d.errors.codeRequired);
      fail(d.errors.codeRequired);
      return;
    }

    setSubmitting(true);
    setCodeError(null);
    const r = await call(
      browserApi.POST('/v1/checkout/place', {
        body: {
          ...(saved
            ? { addressId: saved.id }
            : {
                address: {
                  ...addressBody(newAddr),
                  // Guests give their contact details once, above; the address reuses them.
                  ...(me ? {} : { name: guest.name.trim(), phone: guest.phone.trim() }),
                },
              }),
          ...(me
            ? {}
            : {
                guest: {
                  name: guest.name.trim(),
                  phone: guest.phone.trim(),
                  ...(guest.email.trim() ? { email: guest.email.trim() } : {}),
                },
              }),
          ...(q.guestOtpRequired ? { otpCode: code } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          lang,
          idempotencyKey,
        },
      }),
    );
    if (!r.ok) {
      const notice = cartNoticeFor(r.code);
      if (notice) {
        router.replace(`${href(lang, '/cart')}?notice=${notice}`);
        return;
      }
      setSubmitting(false);
      const text = checkoutError(r, d.errors, lang);
      if (r.code === 'OTP_INVALID' || r.code === 'OTP_EXPIRED' || r.code === 'TOO_MANY_ATTEMPTS') {
        setCodeError(text);
      }
      if (r.code === 'GUEST_LIMIT') setLimitHit(true);
      fail(text);
      return;
    }

    rememberPlaced({
      orderNo: r.data.orderNo,
      grandTotalP: r.data.grandTotalP,
      codDueP: r.data.codDueP,
      etaMinDays: q.zone.etaMinDays,
      etaMaxDays: q.zone.etaMaxDays,
      zoneName: lang === 'bn' && q.zone.nameBn ? q.zone.nameBn : q.zone.nameEn,
      discounts: q.appliedCoupons.map((c) => ({
        name: c.name,
        code: c.code,
        amountP: c.amountP,
        freeDelivery: c.freeDelivery,
      })),
    });
    if (me && choice === NEW && saveNew) {
      // Best effort: the order is already placed, a failed save must not block the success page.
      await call(
        browserApi.POST('/v1/customer/addresses', {
          body: {
            ...addressBody(newAddr),
            label: newAddr.label.trim() || null,
            isDefault: addresses.length === 0,
          },
        }),
      );
    }
    clearLocalCart();
    router.replace(href(lang, `/order/${r.data.orderNo}`));
  }

  return (
    <div className="wrap page">
      <h1 className="page-title">{d.title}</h1>
      <form className={s.layout} onSubmit={submit} noValidate>
        <div className={s.main}>
          <section className={s.card} aria-labelledby="co-contact">
            <h2 id="co-contact" className={s.cardTitle}>
              {d.contact}
            </h2>
            {me ? (
              <div className={s.contactUser}>
                <span className={s.avatar} aria-hidden="true">
                  {me.name.trim().charAt(0).toUpperCase()}
                </span>
                <p>
                  {me.name} <span className={s.muted}>({me.phone})</span>
                </p>
              </div>
            ) : (
              <>
                <p className={s.muted}>
                  {d.contactGuestIntro} {d.haveAccount}{' '}
                  <Link
                    className="link"
                    href={`${href(lang, '/login')}?next=${encodeURIComponent(href(lang, '/checkout'))}`}
                  >
                    {d.loginToFill}
                  </Link>
                </p>
                <Field
                  label={d.name}
                  autoComplete="name"
                  value={guest.name}
                  error={guestErrors.name}
                  onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
                />
                <Field
                  label={d.phone}
                  hint={d.phoneHint}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={guest.phone}
                  error={guestErrors.phone}
                  onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                />
                <Field
                  label={d.email}
                  hint={d.emailHint}
                  type="email"
                  autoComplete="email"
                  value={guest.email}
                  error={guestErrors.email}
                  onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                />
              </>
            )}
          </section>

          <section className={s.card} aria-labelledby="co-ship">
            <h2 id="co-ship" className={s.cardTitle}>
              {d.shipTo}
            </h2>
            {addresses.length > 0 ? (
              <fieldset className={s.choices}>
                <legend className="sr-only">{d.savedAddresses}</legend>
                {addresses.map((a) => (
                  <label key={a.id} className={`${s.choice} ${choice === a.id ? s.on : ''}`}>
                    <input
                      type="radio"
                      name="address"
                      checked={choice === a.id}
                      onChange={() => setChoice(a.id)}
                    />
                    <span>
                      <span>
                        {a.label ? `${a.label}: ` : ''}
                        {a.name}, {a.phone}
                      </span>
                      <span className={s.muted}>
                        {a.line}, {lang === 'bn' && a.placeTextBn ? a.placeTextBn : a.placeText}
                      </span>
                    </span>
                  </label>
                ))}
                <label className={`${s.choice} ${choice === NEW ? s.on : ''}`}>
                  <input
                    type="radio"
                    name="address"
                    checked={choice === NEW}
                    onChange={() => setChoice(NEW)}
                  />
                  <span>{d.newAddress}</span>
                </label>
              </fieldset>
            ) : null}
            {choice === NEW ? (
              <div className={s.fields}>
                <AddressFields
                  lang={lang}
                  value={newAddr}
                  errors={addrErrors}
                  onChange={patchAddr}
                  contact={me !== null}
                  withLabel={me !== null}
                />
                {me ? (
                  <label className={s.check}>
                    <input
                      type="checkbox"
                      checked={saveNew}
                      onChange={(e) => setSaveNew(e.target.checked)}
                    />
                    {d.saveAddress}
                  </label>
                ) : null}
              </div>
            ) : null}
            {quote.status === 'error' ? <Notice kind="error">{quote.message}</Notice> : null}
          </section>

          <section className={s.card} aria-labelledby="co-pay">
            <h2 id="co-pay" className={s.cardTitle}>
              {d.payment}
            </h2>
            <label className={`${s.choice} ${s.on}`}>
              <input type="radio" name="payment" checked readOnly />
              <span>
                <span>{d.cod}</span>
                <span className={s.muted}>{d.codBody}</span>
              </span>
            </label>
          </section>

          {q?.guestOtpRequired ? (
            <OtpBlock
              key={otpPhone ?? ''}
              lang={lang}
              phone={otpPhone}
              code={code}
              onCode={(c) => {
                setCode(c);
                setCodeError(null);
              }}
              error={codeError}
            />
          ) : null}

          <section className={s.card} aria-labelledby="co-note">
            <h2 id="co-note" className={s.cardTitle}>
              {d.note}
            </h2>
            <Field
              label={d.note}
              hint={d.noteHint}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </section>
        </div>

        <Summary lang={lang} cart={cart} quote={q} quoting={quote.status === 'loading'}>
          {cartBlocked || quoteProblem ? (
            <p className={s.error} role="alert">
              {quoteProblem ? d.problems[quoteProblem] : d.problems.CART_CHANGED}{' '}
              <Link className="link" href={href(lang, '/cart')}>
                {d.editCart}
              </Link>
            </p>
          ) : null}
          <div ref={errorRef} tabIndex={-1} className={s.errorBox}>
            {formError ? <Notice kind="error">{formError}</Notice> : null}
            {limitHit && !me ? (
              <Link
                className="link"
                href={`${href(lang, '/login')}?next=${encodeURIComponent(href(lang, '/checkout'))}`}
              >
                {d.loginToOrder}
              </Link>
            ) : null}
          </div>
          <button
            type="submit"
            className={`btn btn-primary btn-lg ${s.placeBtn}`}
            disabled={submitting || blocked}
          >
            {submitting ? d.placing : d.place}
          </button>
          <p className={s.muted}>{d.placeHint}</p>
        </Summary>
      </form>
    </div>
  );
}
