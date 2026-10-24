import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { MailService } from '../mail/mail.service';

export interface Sms {
  /** Normalized BD mobile `01XXXXXXXXX`. */
  to: string;
  text: string;
}

/**
 * SMS sending. The provider is not chosen yet (Q75) and must stay swappable:
 * a real gateway becomes another branch here. Until then every SMS goes to the
 * dev mailbox (Mailpit) as `sms+<phone>@sms.local`, and tests keep it in `outbox`.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  readonly outbox: Sms[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService,
  ) {}

  /** Fire-and-forget, like MailService. */
  send(sms: Sms): void {
    if (this.env.NODE_ENV === 'test') {
      this.outbox.push(sms);
      return;
    }
    this.logger.log(`SMS to ${sms.to}: ${sms.text}`);
    this.mail.send({ to: `sms+${sms.to}@sms.local`, subject: `SMS to ${sms.to}`, text: sms.text });
  }
}
