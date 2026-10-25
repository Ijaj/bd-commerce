import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { StaffAuth } from '../../auth/staff-auth.guard';
import { NoStore } from '../../common/no-store.guard';
import { CustomerErrorDto } from '../../customers/customers.dto';
import { CouponCodesService } from './coupon-codes.service';
import { CouponReportService } from './coupon-report.service';
import { CouponsWriteService } from './coupon-write.service';
import {
  CouponCodesAssignDto,
  CouponCodesAssignedDto,
  CouponCodesGenerateDto,
  CouponCodesGeneratedDto,
  CouponCodesListDto,
  CouponCodesQueryDto,
  CouponCreateDto,
  CouponDetailDto,
  CouponListDto,
  CouponListQueryDto,
  CouponLookupDto,
  CouponLookupQueryDto,
  CouponReportDto,
  CouponReportQueryDto,
  CouponUpdateDto,
} from './coupons.dto';
import { CouponsAdminService } from './coupons-admin.service';

/** Reads need coupons.view; every write, and everything that exposes redeemable codes, needs coupons.manage. */
@NoStore()
@ApiTags('coupons-admin')
@Controller('admin/coupons')
export class CouponsAdminController {
  constructor(
    private readonly coupons: CouponsAdminService,
    private readonly writes: CouponsWriteService,
    private readonly codes: CouponCodesService,
    private readonly reports: CouponReportService,
  ) {}

  @Get()
  @StaffAuth('coupons.view')
  @ApiOkResponse({ type: CouponListDto })
  list(@Query() q: CouponListQueryDto) {
    return this.coupons.list(q);
  }

  @Post()
  @HttpCode(201)
  @StaffAuth('coupons.manage')
  @ApiCreatedResponse({ type: CouponDetailDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  @ApiUnprocessableEntityResponse({ type: CustomerErrorDto })
  create(@Body() body: CouponCreateDto) {
    return this.writes.create(body);
  }

  // Declared before `:id` so "customer-lookup" is not read as an id.
  @Get('customer-lookup')
  @StaffAuth('coupons.manage')
  @ApiOkResponse({ type: CouponLookupDto })
  lookup(@Query() q: CouponLookupQueryDto) {
    return this.coupons.customerLookup(q.q);
  }

  @Get(':id')
  @StaffAuth('coupons.view')
  @ApiOkResponse({ type: CouponDetailDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.detail(id);
  }

  @Patch(':id')
  @StaffAuth('coupons.manage')
  @ApiOkResponse({ type: CouponDetailDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  @ApiUnprocessableEntityResponse({ type: CustomerErrorDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: CouponUpdateDto) {
    return this.writes.update(id, body);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @StaffAuth('coupons.manage')
  @ApiOkResponse({ type: CouponDetailDto })
  @ApiUnprocessableEntityResponse({ type: CustomerErrorDto })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.activate(id);
  }

  @Post(':id/pause')
  @HttpCode(200)
  @StaffAuth('coupons.manage')
  @ApiOkResponse({ type: CouponDetailDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  pause(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.pause(id);
  }

  @Post(':id/duplicate')
  @HttpCode(201)
  @StaffAuth('coupons.manage')
  @ApiCreatedResponse({ type: CouponDetailDto })
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.duplicate(id);
  }

  /** 409 once the coupon was redeemed: pause it instead. */
  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('coupons.manage')
  @ApiNoContentResponse()
  @ApiConflictResponse({ type: CustomerErrorDto })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.remove(id);
  }

  // ---- bulk codes ---------------------------------------------------------------------------

  @Post(':id/codes/generate')
  @HttpCode(201)
  @StaffAuth('coupons.manage')
  @ApiCreatedResponse({ type: CouponCodesGeneratedDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  generate(@Param('id', ParseUUIDPipe) id: string, @Body() body: CouponCodesGenerateDto) {
    return this.codes.generate(id, body);
  }

  @Get(':id/codes')
  @StaffAuth('coupons.manage')
  @ApiOkResponse({ type: CouponCodesListDto })
  listCodes(@Param('id', ParseUUIDPipe) id: string, @Query() q: CouponCodesQueryDto) {
    return this.codes.list(id, q);
  }

  @Get(':id/codes/export')
  @StaffAuth('coupons.manage')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="coupon-codes.csv"')
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string' } })
  exportCodes(@Param('id', ParseUUIDPipe) id: string) {
    return this.codes.exportCsv(id);
  }

  @Post(':id/codes/assign')
  @HttpCode(200)
  @StaffAuth('coupons.manage')
  @ApiOkResponse({ type: CouponCodesAssignedDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() body: CouponCodesAssignDto) {
    return this.codes.assign(id, body.customerId, body.count);
  }

  @Get(':id/report')
  @StaffAuth('coupons.view')
  @ApiOkResponse({ type: CouponReportDto })
  report(@Param('id', ParseUUIDPipe) id: string, @Query() q: CouponReportQueryDto) {
    return this.reports.report(id, q.from, q.to);
  }
}
