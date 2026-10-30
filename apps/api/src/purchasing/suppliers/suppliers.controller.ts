import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../../auth/staff-auth.guard';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { NoStore } from '../../common/no-store.guard';
import { SupplierLedgerService } from './supplier-ledger.service';
import { SupplierLinksService } from './supplier-links.service';
import {
  SupplierAdjustmentDto,
  SupplierCreateDto,
  SupplierDetailDto,
  SupplierErrorDto,
  SupplierLedgerEntryDto,
  SupplierLedgerListDto,
  SupplierLedgerQueryDto,
  SupplierLedgerReverseDto,
  SupplierLinkDto,
  SupplierLinkListDto,
  SupplierLinkListQueryDto,
  SupplierLinkUpsertDto,
  SupplierListDto,
  SupplierListQueryDto,
  SupplierPaymentDto,
  SupplierUpdateDto,
} from './suppliers.dto';
import { SuppliersService } from './suppliers.service';

/** Suppliers + product links: GET needs suppliers.view, writes suppliers.manage. */
@NoStore()
@ApiTags('suppliers')
@Controller('admin/suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly links: SupplierLinksService,
  ) {}

  @Get()
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: SupplierListDto })
  list(@Query() q: SupplierListQueryDto) {
    return this.suppliers.list(q);
  }

  @Post()
  @HttpCode(201)
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: SupplierDetailDto })
  @ApiConflictResponse({ type: SupplierErrorDto })
  create(@Body() body: SupplierCreateDto) {
    return this.suppliers.create(body);
  }

  @Get(':id')
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: SupplierDetailDto })
  @ApiNotFoundResponse({ type: SupplierErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.detail(id);
  }

  @Patch(':id')
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: SupplierDetailDto })
  @ApiConflictResponse({ type: SupplierErrorDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: SupplierUpdateDto) {
    return this.suppliers.update(id, body);
  }

  @Get(':id/variants')
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: SupplierLinkListDto })
  listLinks(@Param('id', ParseUUIDPipe) id: string, @Query() q: SupplierLinkListQueryDto) {
    return this.links.list(id, q);
  }

  @Put(':id/variants/:variantId')
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: SupplierLinkDto })
  upsertLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: SupplierLinkUpsertDto,
  ) {
    return this.links.upsert(id, variantId, body);
  }

  @Delete(':id/variants/:variantId')
  @HttpCode(204)
  @StaffAuth('suppliers.manage')
  async removeLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    await this.links.remove(id, variantId);
  }
}

/** Payables ledger: reads need suppliers.view, every write supplier_payments.manage (C77, no second approver). */
@NoStore()
@ApiTags('supplier ledger')
@Controller('admin')
export class SupplierLedgerController {
  constructor(private readonly ledger: SupplierLedgerService) {}

  @Get('suppliers/:id/ledger')
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: SupplierLedgerListDto })
  list(@Param('id', ParseUUIDPipe) id: string, @Query() q: SupplierLedgerQueryDto) {
    return this.ledger.list(id, q);
  }

  @Post('suppliers/:id/payments')
  @HttpCode(201)
  @StaffAuth('supplier_payments.manage')
  @ApiOkResponse({ type: SupplierLedgerEntryDto })
  pay(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SupplierPaymentDto,
  ) {
    return this.ledger.recordPayment(ctx.staff.id, id, body);
  }

  @Post('suppliers/:id/adjustments')
  @HttpCode(201)
  @StaffAuth('supplier_payments.manage')
  @ApiOkResponse({ type: SupplierLedgerEntryDto })
  adjust(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SupplierAdjustmentDto,
  ) {
    return this.ledger.recordAdjustment(ctx.staff.id, id, body);
  }

  @Post('supplier-ledger/:entryId/reverse')
  @HttpCode(201)
  @StaffAuth('supplier_payments.manage')
  @ApiOkResponse({ type: SupplierLedgerEntryDto })
  @ApiConflictResponse({ type: SupplierErrorDto })
  reverse(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: SupplierLedgerReverseDto,
  ) {
    return this.ledger.reverse(ctx.staff.id, entryId, body);
  }
}
