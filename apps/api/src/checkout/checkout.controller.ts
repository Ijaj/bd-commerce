import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CartIdentityService } from '../cart/cart-identity.service';
import { clientIp } from '../common/client-ip';
import { NoStore } from '../common/no-store.guard';
import { CustomerErrorDto, OtpSentDto } from '../customers/customers.dto';
import {
  CheckoutOtpRequestDto,
  CheckoutPlaceDto,
  CheckoutPlacedDto,
  CheckoutQuoteDto,
  CheckoutQuoteRequestDto,
} from './checkout.dto';
import { CheckoutService } from './checkout.service';

function clientMeta(req: Request) {
  return {
    ip: clientIp(req),
    userAgent: req.headers['user-agent']?.slice(0, 500),
  };
}

@ApiTags('checkout')
@ApiBadRequestResponse({ type: CustomerErrorDto })
@NoStore()
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly identity: CartIdentityService,
  ) {}

  @Post('quote')
  @HttpCode(200)
  @ApiOkResponse({ type: CheckoutQuoteDto })
  async quote(
    @Body() body: CheckoutQuoteRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CheckoutQuoteDto> {
    return this.checkout.quote(await this.identity.resolve(req, res), body);
  }

  @Post('otp')
  @HttpCode(200)
  @ApiOkResponse({ type: OtpSentDto })
  @ApiTooManyRequestsResponse({ type: CustomerErrorDto })
  otp(@Body() body: CheckoutOtpRequestDto, @Req() req: Request): Promise<OtpSentDto> {
    return this.checkout.sendGuestOtp(body.phone, clientMeta(req).ip);
  }

  @Post('place')
  @HttpCode(200)
  @ApiOkResponse({ type: CheckoutPlacedDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  async place(
    @Body() body: CheckoutPlaceDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CheckoutPlacedDto> {
    return this.checkout.place(await this.identity.resolve(req, res), body, clientMeta(req));
  }
}
