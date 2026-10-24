import { randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { SrSaleDetailView } from './sr.dto';
import { srError } from './sr.util';
import { SrSalesService } from './sr-sales.service';

type Lang = 'en' | 'bn';

const T = {
  en: {
    title: 'Sales memo',
    memoNo: 'Memo no',
    date: 'Date',
    billTo: 'Sold to',
    soldBy: 'Sales rep',
    phone: 'Phone',
    item: 'Item',
    qty: 'Qty',
    rate: 'Rate',
    amount: 'Amount',
    total: 'Total',
    paid: 'Paid at sale',
    due: 'Due (baki)',
    note: 'Note',
    receivedBy: 'Received by',
    authorized: 'Authorized by',
    thanks: 'Thank you for your business.',
  },
  bn: {
    title: 'বিক্রয় মেমো',
    memoNo: 'মেমো নং',
    date: 'তারিখ',
    billTo: 'ক্রেতা',
    soldBy: 'বিক্রয় প্রতিনিধি',
    phone: 'ফোন',
    item: 'পণ্য',
    qty: 'পরিমাণ',
    rate: 'দর',
    amount: 'টাকা',
    total: 'মোট',
    paid: 'বিক্রয়কালে পরিশোধ',
    due: 'বাকি',
    note: 'মন্তব্য',
    receivedBy: 'গ্রহীতার স্বাক্ষর',
    authorized: 'অনুমোদনকারী',
    thanks: 'ধন্যবাদ।',
  },
} as const;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Headers are set only on success so error responses stay JSON. */
export function sendHtml(res: Response, html: string): string {
  res.type('text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader('Cache-Control', 'no-store');
  return html;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Same output as @bdc/i18n formatPrice (lakh grouping, BN digits), kept local so the API has no
// dependency on the UI package.
function grouped(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

function digits(value: string, lang: Lang): string {
  return lang === 'bn' ? value.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] as string) : value;
}

export function memoMoney(paisa: number, lang: Lang): string {
  const taka = Math.trunc(paisa / 100);
  const frac = paisa % 100;
  const text = grouped(taka) + (frac ? `.${String(frac).padStart(2, '0')}` : '');
  return `৳${digits(text, lang)}`;
}

function dhakaDate(iso: string, lang: Lang): string {
  const d = new Date(new Date(iso).getTime() + 6 * 3_600_000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return digits(`${dd}/${mm}/${d.getUTCFullYear()}`, lang);
}

/** Printable HTML memo for an approved SR sale (R20). Every user-supplied string is escaped. */
@Injectable()
export class SrMemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SrSalesService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async render(sale: SrSaleDetailView, lang: Lang): Promise<string> {
    if (sale.status !== 'approved' && sale.status !== 'delivered') {
      throw srError(
        ConflictException,
        'NOT_APPROVED',
        'Memo is available once the sale is approved',
      );
    }
    const [seller, shop, contact] = await Promise.all([
      this.prisma.seller.findFirst({ orderBy: { createdAt: 'asc' }, select: { name: true } }),
      this.prisma.b2bShop.findUniqueOrThrow({
        where: { id: sale.shop.id },
        select: { ownerName: true, address: true, area: true },
      }),
      this.settings.get('shop_contact'),
    ]);
    return buildMemoHtml({
      lang,
      sale,
      sellerName: seller?.name ?? '',
      hotline: contact.hotline ?? '',
      shop,
    });
  }

  async forSale(id: string, lang: Lang) {
    return this.render(await this.sales.detail(id), lang);
  }

  /**
   * Share link for an approved or delivered sale (C38). The token is the capability: 32 random
   * bytes, stored on the sale. `rotate` replaces it, which revokes the old link.
   */
  async link(saleId: string, rotate: boolean): Promise<{ token: string; url: string }> {
    const sale = await this.prisma.srSale.findUnique({
      where: { id: saleId },
      select: { status: true, memoToken: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== 'approved' && sale.status !== 'delivered') {
      throw srError(
        ConflictException,
        'NOT_APPROVED',
        'Memo is available once the sale is approved',
      );
    }
    let token = sale.memoToken;
    if (!token || rotate) {
      token = randomBytes(32).toString('base64url');
      await this.prisma.srSale.update({
        where: { id: saleId },
        data: { memoToken: token, memoTokenAt: new Date() },
      });
    }
    const origin = this.env.PUBLIC_API_URL.replace(/\/+$/, '');
    return { token, url: `${origin}/v1/public/memo/${token}` };
  }

  /** Public render by token; unknown, revoked or reversed all look the same (404). */
  async byToken(token: string, lang: Lang): Promise<string> {
    const sale = TOKEN_RE.test(token)
      ? await this.prisma.srSale.findUnique({
          where: { memoToken: token },
          select: { id: true, status: true },
        })
      : null;
    if (!sale || (sale.status !== 'approved' && sale.status !== 'delivered')) {
      throw new NotFoundException('Memo not found');
    }
    return this.forSale(sale.id, lang);
  }
}

export function buildMemoHtml(input: {
  lang: Lang;
  sale: SrSaleDetailView;
  sellerName: string;
  hotline: string;
  shop: { ownerName: string | null; address: string; area: string | null };
}): string {
  const { lang, sale, shop } = input;
  const t = T[lang];
  const e = escapeHtml;
  const money = (p: number) => memoMoney(p, lang);
  const rows = sale.items
    .map((i) => {
      const title = lang === 'bn' ? (i.titleBn ?? i.titleEn) : i.titleEn;
      const opts = lang === 'bn' ? i.optionsTextBn : i.optionsText;
      return (
        `<tr><td>${e(title)}${opts ? ` <span class="muted">(${e(opts)})</span>` : ''}<div class="muted">${e(i.sku)}</div></td>` +
        `<td class="num">${digits(String(i.qty), lang)}</td><td class="num">${money(i.unitPriceP)}</td><td class="num">${money(i.lineTotalP)}</td></tr>`
      );
    })
    .join('');
  const place = [shop.address, shop.area].filter(Boolean).join(', ');
  const stamp = sale.approvedAt ?? sale.submittedAt;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(sale.memoNo)}</title>
<style>
@page { size: A5; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; padding: 12px; font: 13px/1.45 system-ui, "Noto Sans Bengali", sans-serif; color: #111; background: #fff; }
.memo { max-width: 148mm; margin: 0 auto; }
h1 { font-size: 18px; margin: 0; }
.head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
.head .right { text-align: right; }
.muted { color: #555; font-size: 11px; }
.meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.meta div { flex: 1; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 4px 3px; border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; }
th { font-size: 11px; border-bottom: 1px solid #111; }
.num { text-align: right; white-space: nowrap; }
.totals { margin-left: auto; width: 60%; margin-top: 6px; }
.totals td { border: 0; padding: 2px 3px; }
.totals .grand td { border-top: 1px solid #111; font-size: 14px; }
.sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 36px; }
.sign div { flex: 1; border-top: 1px solid #111; padding-top: 3px; text-align: center; font-size: 11px; }
.thanks { text-align: center; margin-top: 12px; }
@media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="memo">
<div class="head">
<div><h1>${e(input.sellerName)}</h1>${input.hotline ? `<div class="muted">${e(input.hotline)}</div>` : ''}</div>
<div class="right"><div>${e(t.title)}</div><div><strong>${e(sale.memoNo)}</strong></div><div class="muted">${e(t.date)}: ${dhakaDate(stamp, lang)}</div></div>
</div>
<div class="meta">
<div><div class="muted">${e(t.billTo)}</div><div>${e(sale.shop.name)}</div>${shop.ownerName ? `<div>${e(shop.ownerName)}</div>` : ''}<div class="muted">${e(place)}</div><div class="muted">${e(t.phone)}: ${e(sale.shop.phone)}</div></div>
<div><div class="muted">${e(t.soldBy)}</div><div>${e(sale.sr.name)}</div></div>
</div>
<table>
<thead><tr><th>${e(t.item)}</th><th class="num">${e(t.qty)}</th><th class="num">${e(t.rate)}</th><th class="num">${e(t.amount)}</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<table class="totals">
<tr><td>${e(t.total)}</td><td class="num">${money(sale.totalP)}</td></tr>
<tr><td>${e(t.paid)}</td><td class="num">${money(sale.paidAtSaleP)}</td></tr>
<tr class="grand"><td>${e(t.due)}</td><td class="num">${money(sale.dueP)}</td></tr>
</table>
${sale.note ? `<p class="muted">${e(t.note)}: ${e(sale.note)}</p>` : ''}
<div class="sign"><div>${e(t.receivedBy)}</div><div>${e(t.authorized)}</div></div>
<p class="thanks muted">${e(t.thanks)}</p>
</div>
</body>
</html>`;
}
