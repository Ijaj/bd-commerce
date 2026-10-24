import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { B2bLedgerService } from './b2b-ledger.service';
import {
  B2bLedgerPageDto,
  B2bLedgerRowDto,
  SrCollectionsQueryDto,
  SrCreateCollectionDto,
  SrCreateSaleDto,
  SrCreateShopDto,
  SrMemoLinkDto,
  SrMemoLinkQueryDto,
  SrMemoQueryDto,
  SrPortalMeDto,
  SrPortalProductDto,
  SrPortalProductsQueryDto,
  SrSaleDetailDto,
  SrSalePageDto,
  SrSalesQueryDto,
  SrShopDetailDto,
  SrShopDto,
  SrShopPageDto,
  SrShopsQueryDto,
} from './sr.dto';
import { SrMemoService, sendHtml } from './sr-memo.service';
import { SrProductsService } from './sr-products.service';
import { SrSalesService } from './sr-sales.service';
import { SrShopsService } from './sr-shops.service';
import { SrStatsService } from './sr-stats.service';

/**
 * SR portal API. Every handler resolves the caller's SR profile first and filters sales and
 * collections by the caller's id (R17). Shops are the one shared list (R14, Q119).
 */
@ApiTags('sr-portal')
@Controller('portal/sr')
@StaffAuth('sr.portal')
export class SrPortalController {
  constructor(
    private readonly stats: SrStatsService,
    private readonly products: SrProductsService,
    private readonly shops: SrShopsService,
    private readonly sales: SrSalesService,
    private readonly ledger: B2bLedgerService,
    private readonly memo: SrMemoService,
  ) {}

  private async sr({ staff }: StaffAuthContext) {
    await this.stats.requireProfile(staff.id);
    return staff.id;
  }

  @Get('me')
  @ApiOkResponse({ type: SrPortalMeDto })
  me(@CurrentStaff() ctx: StaffAuthContext) {
    return this.stats.portalMe(ctx.staff.id, ctx.staff.name);
  }

  @Get('products')
  @ApiOkResponse({ type: [SrPortalProductDto] })
  async productList(@CurrentStaff() ctx: StaffAuthContext, @Query() q: SrPortalProductsQueryDto) {
    await this.sr(ctx);
    return this.products.search(q.q);
  }

  @Get('shops')
  @ApiOkResponse({ type: SrShopPageDto })
  async shopList(@CurrentStaff() ctx: StaffAuthContext, @Query() q: SrShopsQueryDto) {
    await this.sr(ctx);
    return this.shops.portalList(q);
  }

  @Post('shops')
  @ApiCreatedResponse({ type: SrShopDto })
  async createShop(@CurrentStaff() ctx: StaffAuthContext, @Body() body: SrCreateShopDto) {
    return this.shops.create(await this.sr(ctx), body);
  }

  @Get('shops/:id')
  @ApiOkResponse({ type: SrShopDetailDto })
  async shop(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.shops.portalDetail(id, await this.sr(ctx));
  }

  @Get('sales')
  @ApiOkResponse({ type: SrSalePageDto })
  async saleList(@CurrentStaff() ctx: StaffAuthContext, @Query() q: SrSalesQueryDto) {
    return this.sales.portalList(await this.sr(ctx), q);
  }

  @Post('sales')
  @ApiCreatedResponse({ type: SrSaleDetailDto })
  async createSale(@CurrentStaff() ctx: StaffAuthContext, @Body() body: SrCreateSaleDto) {
    return this.sales.create(await this.sr(ctx), body);
  }

  @Get('sales/:id')
  @ApiOkResponse({ type: SrSaleDetailDto })
  async sale(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.sales.portalGet(await this.sr(ctx), id);
  }

  @Post('sales/:id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: SrSaleDetailDto })
  async cancel(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.sales.cancel(await this.sr(ctx), id);
  }

  /** Own sale only; delivery must have been chosen as SR (C42). */
  @Post('sales/:id/deliver')
  @HttpCode(200)
  @ApiOkResponse({ type: SrSaleDetailDto })
  async deliver(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.sales.deliver(await this.sr(ctx), id, true);
  }

  /** Creates (or returns) the public share link of an own approved sale; `?rotate=1` replaces it. */
  @Post('sales/:id/memo-link')
  @HttpCode(200)
  @ApiOkResponse({ type: SrMemoLinkDto })
  async memoLink(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: SrMemoLinkQueryDto,
  ) {
    await this.sales.portalGet(await this.sr(ctx), id);
    return this.memo.link(id, q.rotate !== undefined);
  }

  /** Printable HTML memo of the caller's own approved sale. */
  @Get('sales/:id/memo')
  @ApiProduces('text/html')
  @ApiOkResponse({ description: 'Printable memo (HTML)', schema: { type: 'string' } })
  async memoHtml(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: SrMemoQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sale = await this.sales.portalGet(await this.sr(ctx), id);
    return sendHtml(res, await this.memo.render(sale, q.lang));
  }

  @Post('collections')
  @ApiCreatedResponse({ type: B2bLedgerRowDto })
  async collect(@CurrentStaff() ctx: StaffAuthContext, @Body() body: SrCreateCollectionDto) {
    return this.ledger.recordCollection(await this.sr(ctx), body);
  }

  @Get('collections')
  @ApiOkResponse({ type: B2bLedgerPageDto })
  async collections(@CurrentStaff() ctx: StaffAuthContext, @Query() q: SrCollectionsQueryDto) {
    return this.ledger.collectionsOf(await this.sr(ctx), q.page, q.pageSize);
  }
}
