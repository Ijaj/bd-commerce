import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../config/env';
import { customerCookie } from '../customers/customer-auth.guard';
import { CUSTOMER_COOKIE, CustomerSessionService } from '../customers/customer-session.service';
import type { Customer } from '../generated/prisma/client';
import { ensureVisitorId, readVisitorId } from './visitor';

/** Who owns the cart: the signed-in customer when there is a session, else the visitor cookie. */
export interface CartIdentity {
  customerId: string | null;
  visitorId: string | null;
  customer: Customer | null;
}

@Injectable()
export class CartIdentityService {
  constructor(
    private readonly sessions: CustomerSessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** `issueVisitor` hands out a `bdc_vid` cookie to anonymous browsers that have none. */
  async resolve(req: Request, res: Response, issueVisitor = true): Promise<CartIdentity> {
    const token = req.cookies?.[CUSTOMER_COOKIE];
    const ctx = await this.sessions.resolve(token);
    if (ctx) {
      if (ctx.refreshed) {
        res.cookie(
          CUSTOMER_COOKIE,
          token,
          customerCookie(this.env, await this.sessions.sessionMaxAgeMs()),
        );
      }
      return { customerId: ctx.customer.id, visitorId: readVisitorId(req), customer: ctx.customer };
    }
    const visitorId = issueVisitor ? ensureVisitorId(req, res, this.env) : readVisitorId(req);
    return { customerId: null, visitorId, customer: null };
  }
}
