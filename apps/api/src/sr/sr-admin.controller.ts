import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { clientIp } from '../common/client-ip';
import { REDIS } from '../redis/redis.module';
import { B2bDuesService } from './b2b-dues.service';
import { B2bLedgerService } from './b2b-ledger.service';
import {
  B2bAdjustDto,
  B2bAdjustResultDto,
  B2bCollectionsQueryDto,
  B2bDuesDto,
  B2bDuesQueryDto,
  B2bLedgerPageDto,
  B2bLedgerQueryDto,
  B2bLedgerRowDto,
  B2bShopsQueryDto,
  B2bUpdateShopDto,
  SrAdminSalesQueryDto,
  SrCommissionAdjustmentPageDto,
  SrCommissionAdjustmentsQueryDto,
  SrCommissionComputeDto,
  SrCommissionDto,
  SrCommissionListDto,
  SrListItemDto,
  SrMemoLinkDto,
  SrMemoLinkQueryDto,
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

  /** Staff undo of an approved or delivered sale (C43). */
  @Post('sales/:id/reverse')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: SrSaleDetailDto })
  reverse(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SrRejectSaleDto,
  ) {
    return this.sales.reverse(ctx.staff.id, id, body.reason);
  }

  @Post('sales/:id/memo-link')
  @HttpCode(200)
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: SrMemoLinkDto })
  async memoLink(@Param('id', ParseUUIDPipe) id: string, @Query() q: SrMemoLinkQueryDto) {
    return this.memo.link(id, q.rotate !== undefined);
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

  @Get('list')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: [SrListItemDto] })
  srList() {
    return this.stats.srList();
  }

  @Get('commission-adjustments')
  @StaffAuth('sr.manage')
  @ApiOkResponse({ type: SrCommissionAdjustmentPageDto })
  adjustments(@Query() q: SrCommissionAdjustmentsQueryDto) {
    return this.stats.listAdjustments(q);
  }

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

const MEMO_LIMIT_PER_MIN = 60; // C50

/** Unauthenticated memo page behind an unguessable token (C38). */
@ApiTags('sr-public')
@Controller('public/memo')
export class SrPublicMemoController {
  constructor(
    private readonly memo: SrMemoService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get(':token')
  @ApiProduces('text/html')
  @ApiOkResponse({ description: 'Printable memo (HTML)', schema: { type: 'string' } })
  async get(
    @Param('token') token: string,
    @Query() q: SrMemoQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = `memo:ip:${clientIp(req) ?? 'unknown'}`;
    const hits = await this.redis.incr(key);
    if (hits === 1) await this.redis.expire(key, 60);
    if (hits > MEMO_LIMIT_PER_MIN) {
      res.setHeader('Retry-After', '60');
      throw new HttpException('Too many requests', 429);
    }
    const html = await this.memo.byToken(token, q.lang);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return sendHtml(res, html);
  }
}

@ApiTags('b2b-admin')
@Controller('admin/b2b')
export class B2bAdminController {
  constructor(
    private readonly shops: SrShopsService,
    private readonly ledger: B2bLedgerService,
    private readonly dues: B2bDuesService,
  ) {}

  /** Dues ageing per shop (0-30, 31-60, 61-90, 90+ days), oldest-first against collections. */
  @Get('dues')
  @StaffAuth('b2b.view')
  @ApiOkResponse({ type: B2bDuesDto })
  duesAgeing(@Query() q: B2bDuesQueryDto) {
    return this.dues.dues(q.asOf);
  }

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

  /** Pending collections only; the reason is shown to the SR (C43). */
  @Post('ledger/:id/reject')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: B2bLedgerRowDto })
  reject(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SrRejectSaleDto,
  ) {
    return this.ledger.reject(id, ctx.staff.id, body.reason);
  }

  @Post('ledger/:id/confirm')
  @HttpCode(200)
  @StaffAuth('sr.approve')
  @ApiOkResponse({ type: B2bLedgerRowDto })
  confirm(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.ledger.confirm(id, ctx.staff.id);
  }
}
