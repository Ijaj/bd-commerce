import { type Lang, localizeDigits } from '@bdc/i18n';

const KEYS = [
  'title',
  'invoiceNo',
  'orderNo',
  'date',
  'payment',
  'cod',
  'bin',
  'billTo',
  'shipTo',
  'item',
  'qty',
  'unit',
  'total',
  'subtotal',
  'discount',
  'coupon',
  'delivery',
  'deliveryDiscount',
  'grand',
  'paid',
  'due',
  'net',
  'vat',
  'vatNote',
  'thanks',
] as const;

export const INVOICE_TEXT: Record<Lang, Record<(typeof KEYS)[number], string>> = {
  en: {
    title: 'Tax invoice',
    invoiceNo: 'Invoice no',
    orderNo: 'Order no',
    date: 'Date',
    payment: 'Payment',
    cod: 'Cash on delivery',
    bin: 'BIN',
    billTo: 'Bill to',
    shipTo: 'Ship to',
    item: 'Item',
    qty: 'Qty',
    unit: 'Unit price',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    coupon: 'Coupon',
    delivery: 'Delivery charge',
    deliveryDiscount: 'Delivery discount',
    grand: 'Grand total',
    paid: 'Paid',
    due: 'Due on delivery',
    net: 'Amount before VAT',
    vat: 'VAT included',
    vatNote: 'Prices include VAT.',
    thanks: 'Thank you for your order.',
  },
  bn: {
    title: 'ট্যাক্স ইনভয়েস',
    invoiceNo: 'ইনভয়েস নং',
    orderNo: 'অর্ডার নং',
    date: 'তারিখ',
    payment: 'পেমেন্ট',
    cod: 'ক্যাশ অন ডেলিভারি',
    bin: 'বিআইএন',
    billTo: 'বিল গ্রহীতা',
    shipTo: 'ডেলিভারি ঠিকানা',
    item: 'পণ্য',
    qty: 'পরিমাণ',
    unit: 'একক মূল্য',
    total: 'মোট',
    subtotal: 'সাবটোটাল',
    discount: 'ছাড়',
    coupon: 'কুপন',
    delivery: 'ডেলিভারি চার্জ',
    deliveryDiscount: 'ডেলিভারি ছাড়',
    grand: 'সর্বমোট',
    paid: 'পরিশোধিত',
    due: 'ডেলিভারিতে প্রদেয়',
    net: 'ভ্যাট ছাড়া মূল্য',
    vat: 'ভ্যাট অন্তর্ভুক্ত',
    vatNote: 'মূল্যে ভ্যাট অন্তর্ভুক্ত।',
    thanks: 'আপনার অর্ডারের জন্য ধন্যবাদ।',
  },
};

/** VAT rate in basis points -> "5%" / "7.5%" with the language's digits. */
export function vatPercent(rateBp: number, lang: Lang): string {
  return `${localizeDigits(String(rateBp / 100), lang)}%`;
}

/** Date as 25 Oct 2026 (en) or with Bangla digits (bn); numbers like order no stay English. */
export function invoiceDate(iso: string, lang: Lang): string {
  const s = new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  });
  return localizeDigits(s, lang);
}
