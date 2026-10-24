import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CartService } from '../cart/cart.service';
import { readVisitorId } from '../cart/visitor';
import { clientIp } from '../common/client-ip';
import { NoStore } from '../common/no-store.guard';
import { ENV, type Env } from '../config/env';
import { CurrentCustomer, CustomerAuth, customerCookie } from './customer-auth.guard';
import {
  CUSTOMER_COOKIE,
  type CustomerAuthContext,
  CustomerAuthService,
  toMe,
} from './customer-auth.service';
import {
  CustomerAuthResultDto,
  CustomerChangePasswordDto,
  CustomerErrorDto,
  CustomerLoginDto,
  CustomerMeDto,
  OkDto,
  OtpSentDto,
  RequestOtpDto,
  ResetPasswordDto,
  SignupDto,
  UpdateCustomerDto,
} from './customers.dto';

function meta(req: Request) {
  return {
    ip: clientIp(req),
    userAgent: req.headers['user-agent']?.slice(0, 500),
  };
}

@ApiTags('customer auth')
@ApiBadRequestResponse({ type: CustomerErrorDto })
@ApiUnauthorizedResponse({ type: CustomerErrorDto })
@ApiTooManyRequestsResponse({ type: CustomerErrorDto })
@NoStore()
@Controller('customer')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(
    private readonly auth: CustomerAuthService,
    private readonly cart: CartService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async setSession(res: Response, token: string) {
    res.cookie(CUSTOMER_COOKIE, token, customerCookie(this.env, await this.auth.sessionMaxAgeMs()));
  }

  /** Folds the browser's guest cart into the account cart. Never blocks signing in. */
  private async mergeCart(req: Request, customerId: string) {
    try {
      await this.cart.mergeGuest(readVisitorId(req), customerId);
    } catch (e) {
      this.logger.error(`Cart merge failed for ${customerId}: ${String(e)}`);
    }
  }

  @Post('auth/otp')
  @HttpCode(200)
  @ApiOkResponse({ type: OtpSentDto })
  otp(@Body() body: RequestOtpDto, @Req() req: Request): Promise<OtpSentDto> {
    return this.auth.requestOtp(body.phone, body.purpose, meta(req).ip);
  }

  @Post('auth/signup')
  @HttpCode(200)
  @ApiOkResponse({ type: CustomerAuthResultDto })
  async signup(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerAuthResultDto> {
    const { customer, token } = await this.auth.signup(body, meta(req));
    await this.setSession(res, token);
    await this.mergeCart(req, customer.id);
    return { customer: toMe(customer) };
  }

  @Post('auth/login')
  @HttpCode(200)
  @ApiOkResponse({ type: CustomerAuthResultDto })
  async login(
    @Body() body: CustomerLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerAuthResultDto> {
    const { customer, token } = await this.auth.login(body.login, body.password, meta(req));
    await this.setSession(res, token);
    await this.mergeCart(req, customer.id);
    return { customer: toMe(customer) };
  }

  @Post('auth/reset')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  async reset(@Body() body: ResetPasswordDto): Promise<OkDto> {
    await this.auth.resetPassword(body.phone, body.code, body.password);
    return { ok: true };
  }

  @Post('auth/logout')
  @HttpCode(200)
  @CustomerAuth()
  @ApiOkResponse({ type: OkDto })
  async logout(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OkDto> {
    await this.auth.revoke(ctx.session.id);
    res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @CustomerAuth()
  @ApiOkResponse({ type: CustomerMeDto })
  me(@CurrentCustomer() ctx: CustomerAuthContext): CustomerMeDto {
    return toMe(ctx.customer);
  }

  @Patch('me')
  @CustomerAuth()
  @ApiOkResponse({ type: CustomerMeDto })
  async update(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Body() body: UpdateCustomerDto,
  ): Promise<CustomerMeDto> {
    return toMe(await this.auth.update(ctx.customer, body));
  }

  @Post('me/password')
  @HttpCode(200)
  @CustomerAuth()
  @ApiOkResponse({ type: OkDto })
  async changePassword(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Body() body: CustomerChangePasswordDto,
  ): Promise<OkDto> {
    await this.auth.changePassword(ctx, body.currentPassword, body.newPassword);
    return { ok: true };
  }
}
