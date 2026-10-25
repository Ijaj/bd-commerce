import { formatDateTime } from '~/features/orders/format';
import { fmt, type Lang } from '~/i18n';
import { formatPrice, localizeDigits } from '~/lib/format';
import type { PromosDict } from './strings.en';
import type { CouponLike, RejectReason } from './types';

/** Below this many units the product page and cards say "only N left" for a flash price. */
export const FLASH_LOW = 10;

export function lowFlash(remaining: number): boolean {
  return remaining > 0 && remaining <= FLASH_LOW;
}

/** "2d 03:04:05" / "03:04:05" for a remaining time; null once it reaches zero. */
export function formatRemaining(ms: number, lang: Lang, dayWord: string): string | null {
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const two = (n: number) => localizeDigits(String(n).padStart(2, '0'), lang);
  const clock = `${two(Math.floor((total % 86400) / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
  return days > 0
    ? `${localizeDigits(days, lang)}${lang === 'bn' ? ' ' : ''}${dayWord} ${clock}`
    : clock;
}

/** Percent values come as basis points (10000 = 100%). */
export function percentText(bp: number, lang: Lang): string {
  const pct = bp / 100;
  return localizeDigits(
    Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0$/, ''),
    lang,
  );
}

/** One-line summary of what a coupon gives, by type. */
export function couponValueText(c: CouponLike, lang: Lang, t: PromosDict['coupon']): string {
  switch (c.type) {
    case 'percent':
      return c.maxDiscountP
        ? fmt(t.percentUpTo, {
            n: percentText(c.value, lang),
            max: formatPrice(c.maxDiscountP, lang),
          })
        : fmt(t.percent, { n: percentText(c.value, lang) });
    case 'fixed':
      return fmt(t.fixed, { amt: formatPrice(c.value, lang) });
    case 'free_delivery':
      return t.freeDelivery;
    case 'bxgy':
      return t.bxgy;
    case 'tiered':
      return t.tiered;
    case 'bundle':
      return t.bundle;
  }
}

/** Min order and validity window, in the order a shopper cares about. */
export function couponFacts(c: CouponLike, lang: Lang, t: PromosDict['coupon'], now = Date.now()) {
  const facts: string[] = [];
  if (c.minOrderP) facts.push(fmt(t.minOrder, { amt: formatPrice(c.minOrderP, lang) }));
  if (c.startsAt && Date.parse(c.startsAt) > now) {
    facts.push(fmt(t.startsOn, { date: formatDateTime(c.startsAt, lang) }));
  }
  if (c.endsAt) facts.push(fmt(t.validUntil, { date: formatDateTime(c.endsAt, lang) }));
  return facts;
}

export function rejectText(reason: string | undefined, t: PromosDict['cart']['reasons']): string {
  return reason && reason in t ? t[reason as RejectReason] : t.unknown;
}
