import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { B2bLedgerService } from './b2b-ledger.service';
import {
  B2bAdjustDto,
  B2bAdjustResultDto,
  B2bCollectionsQueryDto,
  B2bLedgerPageDto,
  B2bLedgerQueryDto,
  B2bLedgerRowDto,
  B2bShopsQueryDto,
  B2bUpdateShopDto,
  SrAdminSalesQueryDto,
  SrCommissionComputeDto,
  SrCommissionDto,
  SrCommissionListDto,
  SrMemoQueryDto,
  SrMonthQueryDto,
  SrMonthRequiredQueryDto,
  SrProfileDto,
  SrProfileListDto,
  SrRejectSaleDto,
  SrSaleDetailDto,
  SrSalePageDto,
  SrSetTargetsDto,
  SrShopDto,
  SrShopPageDto,
  SrSummaryDto,
  SrTargetsDto,
  SrUpdateProfileDto,
} from './sr.dto';
import { monthKey } from './sr.util';
import { SrMemoService, sendHtml } from './sr-memo.service';
import { SrSalesService } from './sr-sales.service';
import { SrShopsService } from './sr-shops.service';
import { SrStatsService } from './sr-stats.service';

/**
 * Permissions: reads b2b.view; approve/reject/deliver and confirming collections sr.approve;
 * shop edits and adjustments b2b.manage; profiles, targets, commissions sr.manage.
 */
@ApiTags('sr-admin')
@Controller('admin/sr')
export class SrAdminController {
  constructor(
    private readonly sales: SrSalesService,
    private readonly memo: SrMemoService,
    private readonly stats: SrStatsService,
  ) {}

  @Get('sales')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: SrSalePageDto })
  list(@Query() q: SrAdminSalesQueryDto) {
    return this.sales.adminList(q);
  }

  @Get('sales/:id')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: SrSaleDetailDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.detail(id);
  }

  @Post('sales/:id/approve')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: SrSaleDetailDto })
  approve(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.sales.approve(ctx.staff.id, id);
  }

  @Post('sales/:id/reject')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: SrSaleDetailDto })
  reject(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SrRejectSaleDto,
  ) {
    return this.sales.reject(ctx.staff.id, id, body.reason);
  }

  @Post('sales/:id/deliver')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: SrSaleDetailDto })
  deliver(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.sales.deliver(ctx.staff.id, id);
  }

  @Get('sales/:id/memo')
  @StaffAuth('b2b.view')
  @ApiProduces('text/html')
  @ApiOkResponse({ description: 'Printable memo (HTML)', schema: { type: 'string' } })
  async memoHtml(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: SrMemoQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendHtml(res, await this.memo.forSale(id, q.lang));
  }

  // ---- profiles ----------------------------------------------------------

  @Get('profiles')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrProfileListDto })
  profiles() {
    return this.stats.listProfiles();
  }

  @Get('profiles/:staffId')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrProfileDto })
  profile(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.stats.getProfile(staffId);
  }

  /** Creates the profile when missing, which is what makes a staff member an SR. */
  @Put('profiles/:staffId')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrProfileDto })
  putProfile(@Param('staffId', ParseUUIDPipe) staffId: string, @Body() body: SrUpdateProfileDto) {
    return this.stats.putProfile(staffId, body);
  }

  // ---- numbers, targets, commissions -------------------------------------

  @Get('summary')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: SrSummaryDto })
  summary(@Query() q: SrMonthQueryDto) {
    return this.stats.summary(q.month ?? monthKey(new Date()));
  }

  @Get('targets')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrTargetsDto })
  targets(@Query() q: SrMonthQueryDto) {
    return this.stats.targets(q.month ?? monthKey(new Date()));
  }

  @Put('targets')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrTargetsDto })
  setTargets(@Query() q: SrMonthRequiredQueryDto, @Body() body: SrSetTargetsDto) {
    return this.stats.setTargets(q.month, body.targets);
  }

  @Get('commissions')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrCommissionListDto })
  commissions(@Query() q: SrMonthQueryDto) {
    return this.stats.listCommissions(q.month ?? monthKey(new Date()));
  }

  /** Idempotent while rows are pending; approved and paid rows are never touched. */
  @Post('commissions/compute')
  @HttpCode(200)
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrCommissionComputeDto })
  compute(@Query() q: SrMonthRequiredQueryDto) {
    return this.stats.computeCommissions(q.month);
  }

  @Post('commissions/:id/approve')
  @HttpCode(200)
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrCommissionDto })
  approveCommission(@Param('id', ParseUUIDPipe) id: string) {
    return this.stats.approveCommission(id);
  }

  @Post('commissions/:id/paid')
  @HttpCode(200)
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrCommissionDto })
  paidCommission(@Param('id', ParseUUIDPipe) id: string) {
    return this.stats.markCommissionPaid(id);
  }
}

@ApiTags('b2b-admin')
@Controller('admin/b2b')
export class B2bAdminController {
  constructor(
    private readonly shops: SrShopsService,
    private readonly ledger: B2bLedgerService,
  ) {}

  @Get('shops')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: SrShopPageDto })
  list(@Query() q: B2bShopsQueryDto) {
    return this.shops.adminList(q);
  }

  @Get('shops/:id')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: SrShopDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.shops.get(id);
  }

  @Patch('shops/:id')
  @StaffAuth('b2b.manage')
  @ApiOkResponse({ type: SrShopDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: B2bUpdateShopDto) {
    return this.shops.update(id, body);
  }

  @Get('shops/:id/ledger')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: B2bLedgerPageDto })
  shopLedger(@Param('id', ParseUUIDPipe) id: string, @Query() q: B2bLedgerQueryDto) {
    return this.ledger.shopLedger(id, q.page, q.pageSize);
  }

  @Post('shops/:id/adjust')
  @HttpCode(200)
  @StaffAuth('b2b.manage')
  @ApiOkResponse({ type: B2bAdjustResultDto })
  adjust(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: B2bAdjustDto,
  ) {
    return this.ledger.adjust(id, ctx.staff.id, body);
  }

  /** Collections waiting for staff confirmation (default) or already confirmed. */
  @Get('collections')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: B2bLedgerPageDto })
  collections(@Query() q: B2bCollectionsQueryDto) {
    return this.ledger.collections(q.status, q.page, q.pageSize);
  }

  @Post('ledger/:id/confirm')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: B2bLedgerRowDto })
  confirm(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ledger.confirm(id, ctx.staff.id);
  }
}
