import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NoStore } from '../../common/no-store.guard';
import { CurrentCustomer, CustomerAuth } from '../../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../../customers/customer-session.service';
import { CustomerErrorDto } from '../../customers/customers.dto';
import { CouponWalletItemDto, CouponWalletListDto } from './coupons.dto';
import { CouponsWalletService } from './coupons-wallet.service';

@NoStore()
@ApiTags('customer coupons')
@Controller('customer/coupons')
export class CouponsCustomerController {
  constructor(private readonly wallet: CouponsWalletService) {}

  @Get()
  @CustomerAuth()
  @ApiOkResponse({ type: CouponWalletListDto })
  list(@CurrentCustomer() ctx: CustomerAuthContext) {
    return this.wallet.list(ctx.customer.id);
  }

  @Post(':couponId/collect')
  @HttpCode(200)
  @CustomerAuth()
  @ApiOkResponse({ type: CouponWalletItemDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  collect(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('couponId', ParseUUIDPipe) couponId: string,
  ) {
    return this.wallet.collect(ctx.customer.id, couponId);
  }

  @Delete(':couponId')
  @HttpCode(204)
  @CustomerAuth()
  @ApiNoContentResponse()
  uncollect(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('couponId', ParseUUIDPipe) couponId: string,
  ) {
    return this.wallet.uncollect(ctx.customer.id, couponId);
  }
}
