import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { normalizePhone } from '../customers/phone';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AffiliateCodesService } from './affiliate-codes.service';
import { maskDetails, openDetails, sealDetails } from './affiliate-payout-details';
import type {
  AffiliateJoinDto,
  AffiliateMeDto,
  AffiliatePayoutDetailsDto,
  AffiliateUpdateDto,
} from './affiliates.dto';
import { AffiliateError } from './affiliates.errors';
import { payoutDetailsInput } from './affiliates.schemas';

/** The signed-in customer's own affiliate profile. Payout details go in sealed and never come back in full. */
@Injectable()
export class AffiliateAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly codes: AffiliateCodesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async me(customerId: string): Promise<AffiliateMeDto> {
    const [a, cfg] = await Promise.all([
      this.prisma.affiliate.findUnique({ where: { customerId } }),
      this.settings.get('affiliates'),
    ]);
    if (!a) return { joined: false };
    return {
      joined: true,
      id: a.id,
      code: a.code,
      displayName: a.displayName,
      website: a.website,
      status: a.status,
      commissionBp: a.commissionBp ?? cfg.defaultCommissionBp,
      payoutMethod: a.payoutMethod === 'bkash' || a.payoutMethod === 'bank' ? a.payoutMethod : null,
      payoutDetailsMasked: maskDetails(
        openDetails(a.payoutDetailsEnc, this.env.AFFILIATE_PAYOUT_KEY),
      ),
      clickWindowDays: cfg.clickWindowDays,
      minPayoutP: cfg.minPayoutP,
      programEnabled: cfg.enabled,
    };
  }

  async join(customerId: string, body: AffiliateJoinDto) {
    if (!(await this.settings.get('affiliates')).enabled) {
      throw new AffiliateError(
        HttpStatus.CONFLICT,
        'AFFILIATE_PROGRAM_OFF',
        'The affiliate program is not open right now.',
      );
    }
    if (await this.prisma.affiliate.findUnique({ where: { customerId }, select: { id: true } })) {
      throw alreadyJoined();
    }
    const code = body.code ?? (await this.codes.derive(this.prisma, body.displayName));
    if (body.code) await this.codes.assertFree(this.prisma, code);
    try {
      await this.prisma.affiliate.create({
        data: { customerId, code, displayName: body.displayName, website: body.website ?? null },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Two parallel joins, or the code was taken a moment ago.
        if (
          await this.prisma.affiliate.findUnique({ where: { customerId }, select: { id: true } })
        ) {
          throw alreadyJoined();
        }
        throw new AffiliateError(
          HttpStatus.CONFLICT,
          'AFFILIATE_CODE_TAKEN',
          'That code is already in use.',
        );
      }
      throw e;
    }
    return this.me(customerId);
  }

  async update(customerId: string, body: AffiliateUpdateDto) {
    await this.require(customerId);
    await this.prisma.affiliate.update({
      where: { customerId },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
      },
    });
    return this.me(customerId);
  }

  async setPayoutDetails(customerId: string, body: AffiliatePayoutDetailsDto) {
    await this.require(customerId);
    const parsed = payoutDetailsInput.parse(body);
    const details =
      parsed.method === 'bkash'
        ? { ...parsed, bkashNumber: normalizePhone(parsed.bkashNumber) ?? parsed.bkashNumber }
        : parsed;
    await this.prisma.affiliate.update({
      where: { customerId },
      data: {
        payoutMethod: details.method,
        payoutDetailsEnc: sealDetails(details, this.env.AFFILIATE_PAYOUT_KEY),
      },
    });
    return this.me(customerId);
  }

  private async require(customerId: string) {
    const a = await this.prisma.affiliate.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!a) {
      throw new AffiliateError(
        HttpStatus.NOT_FOUND,
        'AFFILIATE_NOT_JOINED',
        'You have not joined the affiliate program.',
      );
    }
    return a;
  }
}

const alreadyJoined = () =>
  new AffiliateError(
    HttpStatus.CONFLICT,
    'AFFILIATE_ALREADY_JOINED',
    'You are already an affiliate.',
  );
