import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../../auth/staff-auth.guard';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { CustomerErrorDto } from '../../customers/customers.dto';
import {
  BulkSaleCreateDto,
  BulkSaleDetailDto,
  BulkSaleItemsQueryDto,
  BulkSaleListDto,
  BulkSaleListQueryDto,
  BulkSalePreviewDto,
  BulkSalePreviewResultDto,
  BulkSaleUndoResultDto,
} from './bulk-sale.dto';
import { BulkSaleService } from './bulk-sale.service';

@ApiTags('bulk-sales-admin')
@Controller('admin/bulk-sales')
export class BulkSaleController {
  constructor(private readonly bulk: BulkSaleService) {}

  @Post('preview')
  @HttpCode(200)
  @StaffAuth('bulk_sales.manage')
  @ApiOkResponse({ type: BulkSalePreviewResultDto })
  preview(@Body() body: BulkSalePreviewDto) {
    return this.bulk.preview(body);
  }

  @Post()
  @HttpCode(201)
  @StaffAuth('bulk_sales.manage')
  @ApiOkResponse({ type: BulkSaleDetailDto })
  apply(@CurrentStaff() ctx: StaffAuthContext, @Body() body: BulkSaleCreateDto) {
    return this.bulk.apply(ctx.staff.id, body);
  }

  @Get()
  @StaffAuth('bulk_sales.manage')
  @ApiOkResponse({ type: BulkSaleListDto })
  list(@Query() q: BulkSaleListQueryDto) {
    return this.bulk.list(q);
  }

  @Get(':id')
  @StaffAuth('bulk_sales.manage')
  @ApiOkResponse({ type: BulkSaleDetailDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string, @Query() q: BulkSaleItemsQueryDto) {
    return this.bulk.detail(id, q);
  }

  @Post(':id/undo')
  @HttpCode(200)
  @StaffAuth('bulk_sales.manage')
  @ApiOkResponse({ type: BulkSaleUndoResultDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  undo(@Param('id', ParseUUIDPipe) id: string) {
    return this.bulk.undo(id);
  }
}
