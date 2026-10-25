'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '~/components/Icon';
import { Img } from '~/components/Img';
import { EmptyState } from '~/components/States';
import { Notice } from '~/features/account/Field';
import { CartCoupons } from '~/features/promotions/CartCoupons';
import { FlashTag } from '~/features/promotions/FlashTag';
import { dict, fmt, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice, localizeDigits } from '~/lib/format';
import s from './cart.module.css';
import { QtyStepper } from './QtyStepper';
import { refreshCart, removeLine, setCart, setQtyResult, useCart } from './store';
import type { Cart, CartLine, CartNotice } from './types';

export type { CartNotice };

/**
 * Cart page body. `initial` is the server-rendered cart (cookies forwarded); the store then
 * takes over so quantity edits update the header badge too. Any line with a problem blocks
 * checkout, because the API refuses to place such an order.
 */
export function CartView({
  lang,
  initial,
  notice,
}: {
  lang: Lang;
  initial: Cart | null;
  notice?: CartNotice;
}) {
  const d = dict(lang).cart;
  const live = useCart();
  const cart = live ?? initial;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // FLASH_LIMIT: shown on the line that was refused (the API keeps the old quantity).
  const [flashMsg, setFlashMsg] = useState<{ variantId: string; text: string } | null>(null);

  useEffect(() => {
    if (initial) setCart(initial);
    else void refreshCart();
  }, [initial]);

  async function update(variantId: string, qty: number) {
    setBusy(variantId);
    setError(null);
    setFlashMsg(null);
    if (qty <= 0) {
      const next = await removeLine(variantId);
      setBusy(null);
      if (!next) setError(d.updateError);
      return;
    }
    const r = await setQtyResult(variantId, qty);
    setBusy(null);
    if (r.ok) return;
    if (r.code === 'FLASH_LIMIT') {
      const left = typeof r.body?.remaining === 'number' ? r.body.remaining : 0;
      const p = dict(lang).promos.cart;
      setFlashMsg({
        variantId,
        text: left > 0 ? fmt(p.flashLimit, { n: localizeDigits(left, lang) }) : p.flashLimitNone,
      });
      return;
    }
    setError(d.updateError);
  }

  if (!cart) {
    return (
      <div className="wrap page">
        <h1 className="page-title">{d.title}</h1>
        <p role="status" className={s.muted}>
          {d.loading}
        </p>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="wrap page">
        <h1 className="page-title">{d.title}</h1>
        {notice ? <Notice kind="error">{d.notice[notice]}</Notice> : null}
        <EmptyState
          lang={lang}
          title={d.empty}
          body={d.emptyBody}
          action={
            <Link className="btn btn-primary" href={href(lang, '/')}>
              {d.startShopping}
            </Link>
          }
        />
      </div>
    );
  }

  const blocked = cart.items.some((l) => l.problem !== null);
  const countLabel =
    cart.count === 1 ? d.item1 : fmt(d.items, { n: localizeDigits(cart.count, lang) });

  return (
    <div className="wrap page">
      <div className={s.head}>
        <h1 className="page-title">{d.title}</h1>
        <span className={s.muted}>{countLabel}</span>
      </div>
      {notice ? <Notice kind="error">{d.notice[notice]}</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <div className={s.grid}>
        <ul className={s.lines} aria-label={d.title}>
          {cart.items.map((l) => (
            <Line
              key={l.variantId}
              line={l}
              lang={lang}
              busy={busy === l.variantId}
              flashMsg={flashMsg?.variantId === l.variantId ? flashMsg.text : null}
              onQty={(q) => update(l.variantId, q)}
            />
          ))}
        </ul>
        <aside className={s.summary} aria-labelledby="cart-sum">
          <h2 id="cart-sum" className={s.sumTitle}>
            {d.summary}
          </h2>
          <dl className={s.rows}>
            <div className={s.row}>
              <dt>{d.subtotal}</dt>
              <dd>{formatPrice(cart.subtotalP, lang)}</dd>
            </div>
            {cart.discountP > 0 ? (
              <div className={s.row}>
                <dt>{dict(lang).promos.cart.discount}</dt>
                <dd className={s.good}>−{formatPrice(cart.discountP, lang)}</dd>
              </div>
            ) : null}
            <div className={s.row}>
              <dt>{d.delivery}</dt>
              <dd className={s.muted}>{d.deliveryAtCheckout}</dd>
            </div>
          </dl>
          <CartCoupons lang={lang} cart={cart} />
          {blocked ? (
            <>
              <button type="button" className="btn btn-primary" disabled>
                {d.checkout}
              </button>
              <p className={s.blocked} role="alert">
                {d.blocked}
              </p>
            </>
          ) : (
            <Link className="btn btn-primary" href={href(lang, '/checkout')}>
              {fmt(d.checkoutN, { n: localizeDigits(cart.count, lang) })}
            </Link>
          )}
          <p className={s.cod}>
            <Icon name="check" size={16} /> {d.codNote}
          </p>
        </aside>
      </div>
    </div>
  );
}

function problemText(line: CartLine, lang: Lang): string | null {
  const t = dict(lang).cart.problems;
  switch (line.problem) {
    case 'qty_reduced':
      return fmt(t.qty_reduced, { n: localizeDigits(line.available, lang) });
    case null:
      return null;
    default:
      return t[line.problem];
  }
}

function Line({
  line: l,
  lang,
  busy,
  flashMsg,
  onQty,
}: {
  line: CartLine;
  lang: Lang;
  busy: boolean;
  flashMsg: string | null;
  onQty: (qty: number) => void;
}) {
  const d = dict(lang).cart;
  const title = pick(lang, l.titleEn, l.titleBn);
  const options = pick(lang, l.optionsTextEn ?? '', l.optionsTextBn);
  const problem = problemText(l, lang);
  const canChangeQty = l.problem === null || l.problem === 'qty_reduced';
  const onSale = l.compareAtP !== null && l.compareAtP > l.unitPriceP;
  return (
    <li className={`${s.line} ${l.problem ? s.bad : ''}`} aria-busy={busy || undefined}>
      <Link className={s.thumb} href={href(lang, `/p/${l.slug}`)} tabIndex={-1} aria-hidden="true">
        <Img image={l.image} sizes="96px" alt="" />
      </Link>
      <div className={s.info}>
        <Link className={s.name} href={href(lang, `/p/${l.slug}`)}>
          {title}
        </Link>
        {options ? <span className={s.opts}>{options}</span> : null}
        <span className={s.unit}>
          {formatPrice(l.unitPriceP, lang)}
          {onSale && l.compareAtP !== null ? (
            <s className={s.was}>{formatPrice(l.compareAtP, lang)}</s>
          ) : null}
        </span>
        {l.flashEndsAt ? <FlashTag endsAt={l.flashEndsAt} lang={lang} /> : null}
        {l.discountP > 0 ? (
          <span className={s.lineDisc}>
            {fmt(dict(lang).promos.cart.lineDiscount, { amt: formatPrice(l.discountP, lang) })}
          </span>
        ) : null}
        {flashMsg ? (
          <span className={s.problem} role="alert">
            {flashMsg}
          </span>
        ) : null}
        {l.priceChanged ? (
          <span className={s.changed}>
            {fmt(d.priceChanged, {
              was: formatPrice(l.priceAtAddP, lang),
              now: formatPrice(l.unitPriceP, lang),
            })}
          </span>
        ) : null}
        {problem ? (
          <span className={s.problem} role="alert">
            {problem}
            {l.problem === 'qty_reduced' && l.maxQty > 0 ? (
              <button type="button" className={s.linkBtn} onClick={() => onQty(l.maxQty)}>
                {fmt(d.setMax, { n: localizeDigits(l.maxQty, lang) })}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className={s.buy}>
        {canChangeQty ? (
          <QtyStepper
            lang={lang}
            qty={l.qty}
            max={l.maxQty}
            disabled={busy}
            onChange={onQty}
            label={`${d.qty}: ${title}`}
          />
        ) : (
          <span className={s.qtyFixed}>
            {d.qty}: {localizeDigits(l.qty, lang)}
          </span>
        )}
        <span className={s.lineTotal}>{formatPrice(l.unitPriceP * l.qty, lang)}</span>
        <button type="button" className={s.remove} disabled={busy} onClick={() => onQty(0)}>
          <Icon name="close" size={16} />
          <span>{d.remove}</span>
          <span className="sr-only">: {title}</span>
        </button>
      </div>
    </li>
  );
}
