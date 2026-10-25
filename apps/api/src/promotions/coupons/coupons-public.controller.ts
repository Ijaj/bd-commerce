import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CUSTOMER_COOKIE, CustomerSessionService } from '../../customers/customer-session.service';
import { CustomerErrorDto } from '../../customers/customers.dto';
import { CouponPublicListDto } from './coupons.dto';
import { CouponsPublicService } from './coupons-public.service';

const PUBLIC_CACHE = 'public, max-age=30, stale-while-revalidate=120';

/** Offers shown on the shop. Anonymous answers are cacheable; a signed-in customer also gets `collected`. */
@ApiTags('public')
@Controller('public')
export class CouponsPublicController {
  constructor(
    private readonly offers: CouponsPublicService,
    private readonly sessions: CustomerSessionService,
  ) {}

  @Get('coupons')
  @ApiOkResponse({ type: CouponPublicListDto })
  async list(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const customerId = await this.identify(req, res);
    return this.offers.list(customerId);
  }

  @Get('products/:slug/coupons')
  @ApiOkResponse({ type: CouponPublicListDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  async forProduct(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const customerId = await this.identify(req, res);
    return this.offers.forProduct(slug, customerId);
  }

  private async identify(req: Request, res: Response) {
    const token: unknown = req.cookies?.[CUSTOMER_COOKIE];
    const ctx = token ? await this.sessions.resolve(token) : null;
    res.setHeader('Cache-Control', ctx ? 'private, no-store' : PUBLIC_CACHE);
    res.vary('Cookie');
    return ctx?.customer.id ?? null;
  }
}
