import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ThrottleService } from '../auth/throttle.service';
import { ensureVisitorId } from '../cart/visitor';
import { clientIp } from '../common/client-ip';
import { NoStore } from '../common/no-store.guard';
import { ENV, type Env } from '../config/env';
import { AffiliateClicksService } from './affiliate-clicks.service';
import { AffiliateClickDto } from './affiliates.dto';

const CLICKS_PER_MIN = 60;

@NoStore()
@ApiTags('affiliates')
@Controller('public/affiliates')
export class AffiliatesPublicController {
  constructor(
    private readonly clicks: AffiliateClicksService,
    private readonly throttle: ThrottleService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Always 204: the answer must not tell whether a code exists. */
  @Post('click')
  @HttpCode(204)
  @ApiNoContentResponse()
  async click(
    @Body() body: AffiliateClickDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = clientIp(req);
    const key = `aff-click:${ip ?? 'unknown'}`;
    if (await this.throttle.isBlocked(key, CLICKS_PER_MIN)) return;
    await this.throttle.hit(key, 60);
    // A first-time visitor has no cookie yet: issue it here so the later order can find this click.
    const visitorId = ensureVisitorId(req, res, this.env);
    await this.clicks.record({
      code: body.code,
      landingUrl: body.landingUrl,
      ...(body.utm ? { utm: body.utm } : {}),
      visitorId,
      ip,
    });
  }
}
