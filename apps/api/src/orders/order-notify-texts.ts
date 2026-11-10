// Short hard-coded customer texts per order event (A2). SMS and mail share one text.
// TODO native review: all Bangla texts below.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const bnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);

/** Whole taka when possible: 125000 → "1,250", 125050 → "1,250.50". */
export function takaText(paisa: number) {
  const whole = Math.floor(paisa / 100);
  const frac = paisa % 100;
  const base = whole.toLocaleString('en-US');
  return frac === 0 ? base : `${base}.${String(frac).padStart(2, '0')}`;
}

export type NoticeKind =
  | 'confirmed'
  | 'handed_over'
  | 'delivered'
  | 'cancelled'
  | 'refund_paid'
  | 'delivery_failed'
  | 'edited';

export interface NoticeData {
  orderNo: string;
  lang: 'en' | 'bn';
  grandTotalP: number;
  /** Set only for orders with more than one live parcel. */
  shipmentNo?: string | null;
  courierName?: string | null;
  trackingId?: string | null;
  trackingUrl?: string | null;
  /** 'delivery_failed' swaps the cancel text. */
  reason?: string | null;
  refundAmountP?: number | null;
  refundMethod?: 'original' | 'wallet' | null;
}

export interface Notice {
  subject: string;
  text: string;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Pulls the typed bits out of the loose `extra` bag the call sites pass. */
export function noticeExtra(extra: Record<string, unknown>) {
  return {
    shipmentNo: str(extra.shipmentNo),
    courierName: str(extra.courierName),
    trackingId: str(extra.trackingId),
    trackingUrl: str(extra.trackingUrl),
    reason: str(extra.reason),
    refundAmountP: typeof extra.amountP === 'number' ? extra.amountP : null,
    refundMethod:
      extra.method === 'wallet' || extra.method === 'original'
        ? (extra.method as 'wallet' | 'original')
        : null,
  };
}

export function buildNotice(kind: NoticeKind, d: NoticeData): Notice {
  const bn = d.lang === 'bn';
  const o = d.orderNo;
  const parcel = d.shipmentNo
    ? bn
      ? ` (পার্সেল ${d.shipmentNo})`
      : ` (parcel ${d.shipmentNo})`
    : '';
  let subject: string;
  let text: string;
  switch (kind) {
    case 'confirmed':
      subject = bn ? `অর্ডার ${o} নিশ্চিত হয়েছে` : `Order ${o} confirmed`;
      text = bn
        ? `অর্ডার ${o} নিশ্চিত করা হয়েছে। আমরা শীঘ্রই প্রস্তুত করে পাঠাব।`
        : `Order ${o} is confirmed. We will pack and ship it soon.`;
      break;
    case 'handed_over': {
      subject = bn ? `অর্ডার ${o} কুরিয়ারে দেওয়া হয়েছে` : `Order ${o} is on its way`;
      const via = d.courierName
        ? bn
          ? ` ${d.courierName} এর মাধ্যমে`
          : ` with ${d.courierName}`
        : '';
      const track = [d.trackingId, d.trackingUrl].filter(Boolean).join(' ');
      text = bn
        ? `অর্ডার ${o}${parcel} কুরিয়ারে দেওয়া হয়েছে${via}।${track ? ' ট্র্যাকিং: \u0000' : ''}`
        : `Order ${o}${parcel} has been handed to the courier${via}.${track ? ' Tracking: \u0000' : ''}`;
      // Tracking ids and links keep their ASCII digits.
      if (track) {
        const fill = (t: string) => t.replace('\u0000', track);
        return bn
          ? { subject: bnDigits(subject), text: fill(bnDigits(text)) }
          : { subject, text: fill(text) };
      }
      break;
    }
    case 'delivered':
      subject = bn ? `অর্ডার ${o} পৌঁছেছে` : `Order ${o} delivered`;
      text = bn
        ? `অর্ডার ${o}${parcel} ডেলিভারি হয়েছে। কেনাকাটার জন্য ধন্যবাদ!`
        : `Order ${o}${parcel} has been delivered. Thank you for shopping with us!`;
      break;
    case 'cancelled':
      if (d.reason === 'delivery_failed') {
        subject = bn ? `অর্ডার ${o} বন্ধ করা হয়েছে` : `Order ${o} closed`;
        text = bn
          ? `অর্ডার ${o} ডেলিভারি করা সম্ভব হয়নি, তাই অর্ডারটি বন্ধ করা হয়েছে।`
          : `Order ${o} could not be delivered, so the order is closed.`;
      } else {
        subject = bn ? `অর্ডার ${o} বাতিল` : `Order ${o} cancelled`;
        text = bn ? `অর্ডার ${o} বাতিল করা হয়েছে।` : `Order ${o} has been cancelled.`;
      }
      break;
    case 'delivery_failed':
      subject = bn ? `অর্ডার ${o} ডেলিভারি হয়নি` : `Order ${o} could not be delivered`;
      text = bn
        ? `অর্ডার ${o}${parcel} ডেলিভারি করা যায়নি। পার্সেল আমাদের কাছে ফিরে আসছে, আমরা আপনার সাথে যোগাযোগ করব।`
        : `We could not deliver order ${o}${parcel}. The parcel is coming back to us and we will contact you.`;
      break;
    case 'edited':
      subject = bn ? `অর্ডার ${o} পরিবর্তন হয়েছে` : `Order ${o} updated`;
      text = bn
        ? `অর্ডার ${o} পরিবর্তন করা হয়েছে। নতুন মোট ৳${takaText(d.grandTotalP)}।`
        : `Order ${o} was changed. New total Tk ${takaText(d.grandTotalP)}.`;
      break;
    case 'refund_paid': {
      const amt = takaText(d.refundAmountP ?? 0);
      const wallet = d.refundMethod === 'wallet';
      subject = bn ? `অর্ডার ${o} রিফান্ড` : `Refund for order ${o}`;
      text = bn
        ? `অর্ডার ${o} এর ৳${amt} রিফান্ড হয়েছে${wallet ? ' (ওয়ালেটে)' : ' (আপনার মূল পেমেন্ট মাধ্যমে)'}।`
        : `Tk ${amt} has been refunded for order ${o} ${wallet ? 'to your wallet' : 'to your original payment method'}.`;
      break;
    }
  }
  return bn ? { subject: bnDigits(subject), text: bnDigits(text) } : { subject, text };
}
