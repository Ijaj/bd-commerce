'use client';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Img } from '~/components/Img';
import { Price } from '~/components/Price';
import { WishlistHeart } from '~/features/account/WishlistHeart';
import { FlashBox } from '~/features/promotions/FlashBox';
import { dict, fmt, type Lang, pick } from '~/i18n';
import { href } from '~/i18n/routing';
import { formatPrice, localizeDigits } from '~/lib/format';
import { addToCart } from './cart-actions';
import { MinusIcon, PlusIcon } from './icons';
import {
  canOrder,
  initialSelection,
  maxQty,
  type Selection,
  selectValue,
  valueState,
  variantFor,
} from './logic';
import s from './Product.module.css';
import type { ProductDetail } from './types';

const SIZES = '(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 560px';
const LOW_STOCK = 5;
/** Where "Buy now" / "Pre-order now" go after the item is in the cart. */
const BUY_NOW_PATH = '/cart';

/**
 * Top of the product page: gallery + purchase box in one client component so choosing a variant
 * can switch the gallery image. The server-rendered `header` (title, rating, brand) sits between.
 */
export function ProductView({
  product: p,
  lang,
  header,
  preorderDate,
}: {
  product: ProductDetail;
  lang: Lang;
  header: ReactNode;
  preorderDate: string | null;
}) {
  const d = dict(lang).browse;
  const [sel, setSel] = useState<Selection>(() => initialSelection(p));
  const variant = useMemo(() => variantFor(p.variants, sel, p.options), [p, sel]);
  const orderable = canOrder(variant, p);
  const cap = maxQty(variant, p);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [busy, setBusy] = useState<null | 'add' | 'buy'>(null);
  const [toast, setToast] = useState<{ text: string; err: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => setQty((q) => Math.min(q, cap)), [cap]);

  // variant-aware gallery: jump to the first image tagged with the chosen variant
  const variantId = variant?.id;
  useEffect(() => {
    if (!variantId) return;
    const i = p.images.findIndex((im) => im.variantId === variantId);
    if (i >= 0) setImg(i);
  }, [variantId, p.images]);

  const say = (text: string, err = false) => {
    setToast({ text, err });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  async function submit(kind: 'add' | 'buy') {
    if (!variant || busy) return;
    setBusy(kind);
    const r = await addToCart(variant.id, qty, cap);
    setBusy(null);
    if (!r.ok) {
      if (r.flashRemaining !== undefined) {
        say(
          r.flashRemaining > 0
            ? fmt(dict(lang).promos.cart.flashLimit, { n: localizeDigits(r.flashRemaining, lang) })
            : dict(lang).promos.cart.flashLimitNone,
          true,
        );
        return;
      }
      say(d.cartFailed, true);
      return;
    }
    if (kind === 'buy') {
      window.location.assign(href(lang, BUY_NOW_PATH));
      return;
    }
    say(d.addedToCart);
  }

  const images = p.images;
  const cur = images[Math.min(img, images.length - 1)] ?? null;
  const title = pick(lang, p.titleEn, p.titleBn);
  const price = variant ?? p.variants.find((v) => v.isActive) ?? null;
  const save =
    price?.compareAtP && price.compareAtP > price.priceP ? price.compareAtP - price.priceP : 0;

  let stock: { cls: string | undefined; text: string };
  if (p.isUpcoming) stock = { cls: s.stockPre, text: d.upcomingStock };
  else if (!variant) stock = { cls: s.stockOut, text: d.unavailable };
  else if (p.isPreorder)
    stock = {
      cls: s.stockPre,
      text: preorderDate ? fmt(d.preorderExpected, { date: preorderDate }) : d.preorderStock,
    };
  else if (variant.available <= 0) stock = { cls: s.stockOut, text: d.outOfStock };
  else if (variant.available <= LOW_STOCK)
    stock = {
      cls: s.stockLow,
      text: fmt(d.onlyLeft, { n: localizeDigits(variant.available, lang) }),
    };
  else stock = { cls: s.stockIn, text: d.inStockNow };

  const b = p.badges;
  const c = dict(lang).common;
  const badges = [
    b.isNew ? { cls: '', label: c.new } : null,
    p.isPreorder ? { cls: s.bPre, label: c.preorder } : null,
    p.isUpcoming ? { cls: s.bUp, label: c.upcoming } : null,
  ].filter((x): x is { cls: string; label: string } => x !== null);

  return (
    <div className={s.top}>
      <div className={s.gal}>
        <div className={s.stage}>
          {cur ? (
            <Img
              key={cur.url640}
              image={cur}
              alt={cur.alt || title}
              sizes={SIZES}
              priority={img === 0}
              className={s.main}
            />
          ) : (
            <Img image={null} sizes={SIZES} />
          )}
          {badges.length > 0 ? (
            <span className={s.badges}>
              {badges.map((x) => (
                <span key={x.label} className={`${s.bdg} ${x.cls}`}>
                  {x.label}
                </span>
              ))}
            </span>
          ) : null}
          {images.length > 1 ? (
            <p className={s.counter} aria-live="polite">
              {fmt(d.imageN, {
                n: localizeDigits(img + 1, lang),
                m: localizeDigits(images.length, lang),
              })}
            </p>
          ) : null}
        </div>
        {images.length > 1 ? (
          <ul className={s.thumbs} aria-label={d.gallery}>
            {images.map((im, i) => (
              <li key={im.url320}>
                <button
                  type="button"
                  className={`${s.thumb} ${i === img ? s.thumbOn : ''}`}
                  aria-pressed={i === img}
                  aria-label={fmt(d.showImage, { n: localizeDigits(i + 1, lang) })}
                  onClick={() => setImg(i)}
                >
                  {/* biome-ignore lint/performance/noImgElement: imgproxy thumbnail */}
                  <img src={im.url320} alt="" width={64} height={64} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={s.info}>
        {header}

        {price ? (
          <div className={s.pbox}>
            <Price
              lang={lang}
              size="lg"
              priceP={price.priceP}
              compareAtP={price.compareAtP}
              discountPct={price.discountPct}
            />
            {save > 0 ? (
              <p className={s.save}>{fmt(d.save, { amt: formatPrice(save, lang) })}</p>
            ) : null}
            {price.flash ? <FlashBox flash={price.flash} lang={lang} /> : null}
          </div>
        ) : null}

        {p.options.map((o) => {
          const name = pick(lang, o.nameEn, o.nameBn);
          const chosen = o.values.find((v) => v.id === sel[o.position - 1]);
          return (
            <div key={o.position} className={s.optGroup}>
              <p className={s.optLabel} id={`opt-${o.position}`}>
                {name}
                {chosen ? <span>: {pick(lang, chosen.valueEn, chosen.valueBn)}</span> : null}
              </p>
              <div className={s.optValues} role="radiogroup" aria-labelledby={`opt-${o.position}`}>
                {o.values.map((v) => {
                  const state = valueState(p, o.position, v.id, sel);
                  const on = sel[o.position - 1] === v.id;
                  const label = pick(lang, v.valueEn, v.valueBn);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={state === 'none'}
                      title={label}
                      className={`${v.swatchHex ? s.swatch : s.size} ${on ? s.optOn : ''} ${state !== 'ok' ? s.optOff : ''}`}
                      style={
                        v.swatchHex ? ({ '--c': v.swatchHex } as React.CSSProperties) : undefined
                      }
                      onClick={() => setSel(selectValue(p, o.position, v.id, sel))}
                    >
                      {v.swatchHex ? <span className="sr-only">{label}</span> : label}
                      {state === 'soldout' ? (
                        <span className="sr-only"> - {d.soldOutOption}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <p className={`${s.stock} ${stock.cls}`} role="status">
          {stock.text}
        </p>

        {p.isUpcoming ? (
          <div className={s.note}>
            <p>{d.upcomingNote}</p>
            <div className={s.ctas}>
              <WishlistHeart productId={p.id} lang={lang} />
            </div>
          </div>
        ) : (
          <>
            {p.isPreorder ? <p className={s.note}>{d.preorderNote}</p> : null}
            {orderable ? (
              <div className={s.qtyRow}>
                <span className={s.optLabel} id="qty-l">
                  {d.qty}
                </span>
                <div className={s.stepper} role="group" aria-labelledby="qty-l">
                  <button
                    type="button"
                    aria-label={d.qtyDec}
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <MinusIcon />
                  </button>
                  <output aria-live="polite">{localizeDigits(qty, lang)}</output>
                  <button
                    type="button"
                    aria-label={d.qtyInc}
                    disabled={qty >= cap}
                    onClick={() => setQty((q) => Math.min(cap, q + 1))}
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            ) : null}
            <div className={s.ctas}>
              {!orderable ? (
                <button type="button" className="btn btn-primary" disabled>
                  {d.outOfStock}
                </button>
              ) : p.isPreorder ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy !== null}
                  onClick={() => submit('buy')}
                >
                  {d.preorderNow}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy !== null}
                    onClick={() => submit('add')}
                  >
                    {d.addToCart}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy !== null}
                    onClick={() => submit('buy')}
                  >
                    {d.buyNow}
                  </button>
                </>
              )}
              <WishlistHeart productId={p.id} lang={lang} />
            </div>
          </>
        )}
        {variant ? (
          <p className={s.sku}>
            {d.sku}: {variant.sku}
          </p>
        ) : null}
      </div>

      <div
        className={`${s.toast} ${toast ? s.toastOn : ''} ${toast?.err ? s.toastErr : ''}`}
        role="status"
      >
        {toast ? (
          <>
            <span>{toast.text}</span>
            {!toast.err ? (
              <Link href={href(lang, '/cart')} className={s.toastLink}>
                {d.viewCart}
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
