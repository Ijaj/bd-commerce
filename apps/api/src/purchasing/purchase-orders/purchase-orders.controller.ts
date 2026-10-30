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
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../../auth/staff-auth.guard';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { NoStore } from '../../common/no-store.guard';
import {
  PoCancelDto,
  PoCloseDto,
  PoCreateDto,
  PoDetailDto,
  PoErrorDto,
  PoListDto,
  PoListQueryDto,
  PoPatchDto,
  PoPrintDto,
  PoReceiveDto,
  PoSendResultDto,
  PoVariantOptionDto,
  PoVariantOptionsQueryDto,
} from './po.dto';
import { PoService } from './po.service';
import { PoReadService } from './po-read.service';
import { PoReceivingService } from './po-receiving.service';

/** Reads need suppliers.view, edits suppliers.manage, receiving purchase_orders.receive (C73). */
@NoStore()
@ApiTags('purchase orders')
@Controller('admin/purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly read: PoReadService,
    private readonly pos: PoService,
    private readonly receiving: PoReceivingService,
  ) {}

  @Get()
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: PoListDto })
  list(@Query() q: PoListQueryDto) {
    return this.read.list(q);
  }

  @Get('variant-options')
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: [PoVariantOptionDto] })
  variantOptions(@Query() q: PoVariantOptionsQueryDto) {
    return this.read.variantOptions(q);
  }

  @Post()
  @HttpCode(201)
  @StaffAuth('suppliers.manage')
  @ApiCreatedResponse({ type: PoDetailDto })
  @ApiConflictResponse({ type: PoErrorDto, description: 'SUPPLIER_INACTIVE, PO_DROPSHIP_VARIANT' })
  create(@CurrentStaff() ctx: StaffAuthContext, @Body() body: PoCreateDto) {
    return this.pos.create(ctx.staff.id, body);
  }

  @Get(':id')
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: PoDetailDto })
  @ApiNotFoundResponse({ type: PoErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.read.detail(id);
  }

  @Get(':id/print')
  @StaffAuth('suppliers.view')
  @ApiOkResponse({ type: PoPrintDto })
  @ApiNotFoundResponse({ type: PoErrorDto })
  print(@Param('id', ParseUUIDPipe) id: string) {
    return this.read.print(id);
  }

  @Patch(':id')
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: PoDetailDto })
  @ApiConflictResponse({ type: PoErrorDto, description: 'PO_LOCKED' })
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() body: PoPatchDto) {
    return this.pos.patch(id, body);
  }

  @Post(':id/send')
  @HttpCode(200)
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: PoSendResultDto })
  @ApiConflictResponse({ type: PoErrorDto, description: 'PO_BAD_STATUS' })
  send(@Param('id', ParseUUIDPipe) id: string) {
    return this.pos.send(id);
  }

  @Post(':id/receive')
  @HttpCode(200)
  @StaffAuth('purchase_orders.receive')
  @ApiOkResponse({ type: PoDetailDto })
  @ApiConflictResponse({ type: PoErrorDto, description: 'PO_BAD_STATUS, PO_OVER_RECEIVE' })
  receive(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PoReceiveDto,
  ) {
    return this.receiving.receive(ctx.staff.id, id, body);
  }

  @Post(':id/close')
  @HttpCode(200)
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: PoDetailDto })
  @ApiConflictResponse({ type: PoErrorDto, description: 'PO_BAD_STATUS' })
  close(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PoCloseDto,
  ) {
    return this.pos.close(ctx.staff.id, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @StaffAuth('suppliers.manage')
  @ApiOkResponse({ type: PoDetailDto })
  @ApiConflictResponse({ type: PoErrorDto, description: 'PO_BAD_STATUS' })
  cancel(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PoCancelDto,
  ) {
    return this.pos.cancel(ctx.staff.id, id, body);
  }
}
