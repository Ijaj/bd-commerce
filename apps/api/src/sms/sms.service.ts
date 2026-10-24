import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { MailService } from '../mail/mail.service';

export interface Sms {
  /** Normalized BD mobile `01XXXXXXXXX`. */
  to: string;
  text: string;
}

const OUTBOX_MAX = 500;

/**
 * SMS sending. The provider is not chosen yet (Q75) and must stay swappable: a real gateway becomes
 * another branch here. Until then every SMS goes to the dev mailbox (Mailpit) as
 * `sms+<phone>@sms.local`, and tests keep it in `outbox`. Production refuses to boot on the stub so
 * codes can never end up in a log or a dev mailbox there.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  readonly outbox: Sms[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService,
  ) {
    if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'dev') {
      throw new Error(
        'SMS_PROVIDER=dev is a development stub and cannot run in production. Pick a real SMS provider (Q75).',
      );
    }
  }

  /** Fire-and-forget, like MailService. */
  send(sms: Sms): void {
    if (this.env.NODE_ENV === 'test' || this.env.E2E_EXPOSE_OTP === '1') {
      this.outbox.push(sms);
      if (this.outbox.length > OUTBOX_MAX) this.outbox.shift();
    }
    if (this.env.NODE_ENV === 'test') return;
    if (this.env.NODE_ENV === 'development') {
      // The text carries one-time codes: it is only ever logged in development.
      this.logger.log(`SMS to ${sms.to}: ${sms.text}`);
      this.mail.send({
        to: `sms+${sms.to}@sms.local`,
        subject: `SMS to ${sms.to}`,
        text: sms.text,
      });
      return;
    }
    this.logger.log(
      `SMS to ${sms.to.slice(0, 3)}******${sms.to.slice(-2)} (${sms.text.length} chars)`,
    );
  }

  /** Newest SMS to a phone, for the e2e-only endpoint. */
  lastTo(phone: string): Sms | undefined {
    return this.outbox.findLast((s) => s.to === phone);
  }
}
