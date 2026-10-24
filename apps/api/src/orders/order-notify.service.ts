import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';

export interface PlacedOrderNotice {
  orderNo: string;
  lang: 'en' | 'bn';
  grandTotalP: number;
  codDueP: number;
  phone: string | null;
  email: string | null;
  etaMinDays: number;
  etaMaxDays: number;
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);

/** Whole taka when possible: 125000 → "1,250", 125050 → "1,250.50". */
export function takaText(paisa: number) {
  const whole = Math.floor(paisa / 100);
  const frac = paisa % 100;
  const base = whole.toLocaleString('en-US');
  return frac === 0 ? base : `${base}.${String(frac).padStart(2, '0')}`;
}

@Injectable()
export class OrderNotifyService {
  constructor(
    private readonly sms: SmsService,
    private readonly mail: MailService,
  ) {}

  /** Fire-and-forget; SmsService and MailService never throw. */
  placed(n: PlacedOrderNotice) {
    const bn = n.lang === 'bn';
    const eta =
      n.etaMinDays === n.etaMaxDays ? `${n.etaMinDays}` : `${n.etaMinDays}-${n.etaMaxDays}`;
    const text = bn
      ? bnDigits(
          `অর্ডার ${n.orderNo} গ্রহণ করা হয়েছে। মোট ৳${takaText(n.grandTotalP)}, ডেলিভারিতে পরিশোধ করুন। ${eta} দিনের মধ্যে পাবেন।`,
        )
      : `Order ${n.orderNo} received. Total Tk ${takaText(n.grandTotalP)}, pay on delivery. Expected in ${eta} days.`;
    if (n.phone) this.sms.send({ to: n.phone, text });
    if (n.email) {
      this.mail.send({
        to: n.email,
        subject: bn ? bnDigits(`অর্ডার ${n.orderNo} নিশ্চিত`) : `Order ${n.orderNo} confirmed`,
        text,
      });
    }
  }
}
