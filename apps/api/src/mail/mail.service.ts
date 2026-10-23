import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** SMTP mail: Mailpit in dev, SES SMTP in production. Tests keep mail in `outbox`. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter;
  readonly outbox: Mail[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transport =
      env.NODE_ENV === 'test'
        ? createTransport({ jsonTransport: true })
        : createTransport(env.SMTP_URL);
  }

  /** Fire-and-forget until the BullMQ queue exists; failures are logged, never thrown. */
  send(mail: Mail): void {
    if (this.env.NODE_ENV === 'test') this.outbox.push(mail);
    this.transport
      .sendMail({ from: this.env.MAIL_FROM, ...mail })
      .catch((err: unknown) => this.logger.error(`Mail to ${mail.to} failed: ${String(err)}`));
  }
}
