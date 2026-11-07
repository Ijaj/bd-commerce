import { Body, Controller, Get, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { NoStore } from '../common/no-store.guard';
import { CurrentCustomer, CustomerAuth } from '../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../customers/customer-session.service';
import { AffiliateAccountService } from './affiliate-account.service';
import { AffiliateReportService } from './affiliate-report.service';
import {
  AffiliateErrorDto,
  AffiliateJoinDto,
  AffiliateMeDto,
  AffiliateMyCommissionListDto,
  AffiliateMyCommissionQueryDto,
  AffiliateMyPayoutListDto,
  AffiliateMyPayoutQueryDto,
  AffiliatePayoutDetailsDto,
  AffiliateStatsDto,
  AffiliateStatsQueryDto,
  AffiliateUpdateDto,
} from './affiliates.dto';

/** The shop's /account/affiliate screens. Nothing here shows who the buyers are. */
@NoStore()
@ApiTags('customer affiliate')
@Controller('customer/affiliate')
export class AffiliatesCustomerController {
  constructor(
    private readonly account: AffiliateAccountService,
    private readonly report: AffiliateReportService,
  ) {}

  @Get()
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateMeDto })
  me(@CurrentCustomer() ctx: CustomerAuthContext) {
    return this.account.me(ctx.customer.id);
  }

  @Post('join')
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateMeDto })
  @ApiConflictResponse({ type: AffiliateErrorDto })
  join(@CurrentCustomer() ctx: CustomerAuthContext, @Body() body: AffiliateJoinDto) {
    return this.account.join(ctx.customer.id, body);
  }

  @Patch()
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateMeDto })
  @ApiNotFoundResponse({ type: AffiliateErrorDto })
  update(@CurrentCustomer() ctx: CustomerAuthContext, @Body() body: AffiliateUpdateDto) {
    return this.account.update(ctx.customer.id, body);
  }

  @Put('payout-details')
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateMeDto })
  @ApiNotFoundResponse({ type: AffiliateErrorDto })
  setPayoutDetails(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Body() body: AffiliatePayoutDetailsDto,
  ) {
    return this.account.setPayoutDetails(ctx.customer.id, body);
  }

  @Get('stats')
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateStatsDto })
  stats(@CurrentCustomer() ctx: CustomerAuthContext, @Query() q: AffiliateStatsQueryDto) {
    return this.report.stats(ctx.customer.id, q.days);
  }

  @Get('commissions')
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateMyCommissionListDto })
  commissions(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Query() q: AffiliateMyCommissionQueryDto,
  ) {
    return this.report.commissions(ctx.customer.id, q);
  }

  @Get('payouts')
  @CustomerAuth()
  @ApiOkResponse({ type: AffiliateMyPayoutListDto })
  payouts(@CurrentCustomer() ctx: CustomerAuthContext, @Query() q: AffiliateMyPayoutQueryDto) {
    return this.report.payouts(ctx.customer.id, q);
  }
}
