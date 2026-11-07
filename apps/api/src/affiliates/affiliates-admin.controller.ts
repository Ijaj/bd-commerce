import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { NoStore } from '../common/no-store.guard';
import { AffiliateAdminService } from './affiliate-admin.service';
import { AffiliatePayoutsService } from './affiliate-payouts.service';
import {
  AffiliateAdminCommissionListDto,
  AffiliateAdminCommissionQueryDto,
  AffiliateAdminDetailDto,
  AffiliateAdminListDto,
  AffiliateAdminListQueryDto,
  AffiliateAdminUpdateDto,
  AffiliateDueListDto,
  AffiliateErrorDto,
  AffiliatePayoutCreateDto,
  AffiliatePayoutDto,
  AffiliatePayoutListDto,
  AffiliatePayoutListQueryDto,
} from './affiliates.dto';

const sees = (ctx: StaffAuthContext) => ctx.permissions.has('affiliate_payouts.manage');

/** Affiliates: GET needs affiliates.view, changes affiliates.manage, money affiliate_payouts.manage. */
@NoStore()
@ApiTags('affiliates admin')
@Controller('admin')
export class AffiliatesAdminController {
  constructor(
    private readonly admin: AffiliateAdminService,
    private readonly payouts: AffiliatePayoutsService,
  ) {}

  @Get('affiliates')
  @StaffAuth('affiliates.view')
  @ApiOkResponse({ type: AffiliateAdminListDto })
  list(@Query() q: AffiliateAdminListQueryDto) {
    return this.admin.list(q);
  }

  @Get('affiliates/:id')
  @StaffAuth('affiliates.view')
  @ApiOkResponse({ type: AffiliateAdminDetailDto })
  @ApiNotFoundResponse({ type: AffiliateErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() ctx: StaffAuthContext) {
    return this.admin.detail(id, sees(ctx));
  }

  @Patch('affiliates/:id')
  @StaffAuth('affiliates.manage')
  @ApiOkResponse({ type: AffiliateAdminDetailDto })
  @ApiNotFoundResponse({ type: AffiliateErrorDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AffiliateAdminUpdateDto,
    @CurrentStaff() ctx: StaffAuthContext,
  ) {
    return this.admin.update(id, body, sees(ctx));
  }

  @Get('affiliates/:id/commissions')
  @StaffAuth('affiliates.view')
  @ApiOkResponse({ type: AffiliateAdminCommissionListDto })
  commissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: AffiliateAdminCommissionQueryDto,
  ) {
    return this.admin.commissions(id, q);
  }

  @Get('affiliate-payouts/due')
  @StaffAuth('affiliate_payouts.manage')
  @ApiOkResponse({ type: AffiliateDueListDto })
  due() {
    return this.payouts.due();
  }

  @Get('affiliate-payouts')
  @StaffAuth('affiliate_payouts.manage')
  @ApiOkResponse({ type: AffiliatePayoutListDto })
  listPayouts(@Query() q: AffiliatePayoutListQueryDto) {
    return this.payouts.list(q);
  }

  @Post('affiliates/:id/payouts')
  @HttpCode(201)
  @StaffAuth('affiliate_payouts.manage')
  @ApiOkResponse({ type: AffiliatePayoutDto })
  @ApiConflictResponse({ type: AffiliateErrorDto })
  recordPayout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AffiliatePayoutCreateDto,
    @CurrentStaff() ctx: StaffAuthContext,
  ) {
    return this.payouts.record(id, ctx.staff.id, body);
  }
}
