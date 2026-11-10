import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { NoStore } from '../common/no-store.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CallQueueService } from './call-queue.service';
import { OrderCancelService } from './order-cancel.service';
import {
  CourierRowDto,
  OrderEditHistoryDto,
  OrderEditInputDto,
  OrderEditPreviewDto,
  OrderEditSavedDto,
} from './order-edit.dto';
import { OrderEditService } from './order-edit.service';
import {
  OrdersAdminCallCountDto,
  OrdersAdminCallOutcomeDto,
  OrdersAdminCallQueueQueryDto,
  OrdersAdminDetailDto,
  OrdersAdminListDto,
  OrdersAdminListQueryDto,
  OrdersAdminReasonDto,
} from './orders-admin.dto';
import { OrdersAdminService } from './orders-admin.service';

/** Permissions: reads orders.view; hold/resume/cancel orders.manage; the call queue orders.call. */
@NoStore()
@ApiTags('orders-admin')
@Controller('admin/orders')
export class OrdersAdminController {
  constructor(
    private readonly orders: OrdersAdminService,
    private readonly cancelService: OrderCancelService,
    private readonly queue: CallQueueService,
    private readonly edits: OrderEditService,
  ) {}

  @Get()
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: OrdersAdminListDto })
  list(@Query() q: OrdersAdminListQueryDto) {
    return this.orders.list(q);
  }

  @Get(':id')
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: OrdersAdminDetailDto })
  @ApiNotFoundResponse()
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Get(':id/edits')
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: OrderEditHistoryDto })
  @ApiNotFoundResponse()
  editHistory(@Param('id') id: string) {
    return this.edits.history(id);
  }

  @Post(':id/edit/preview')
  @HttpCode(200)
  @StaffAuth('orders.edit')
  @ApiOkResponse({ type: OrderEditPreviewDto })
  @ApiConflictResponse()
  editPreview(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: OrderEditInputDto,
  ) {
    return this.edits.preview(id, ctx.staff.id, body);
  }

  @Post(':id/edit')
  @HttpCode(200)
  @StaffAuth('orders.edit')
  @ApiOkResponse({ type: OrderEditSavedDto })
  @ApiConflictResponse()
  async edit(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: OrderEditInputDto,
  ) {
    const r = await this.edits.save(id, ctx.staff.id, body);
    return { order: await this.orders.detail(r.orderId), edit: r.edit };
  }

  @Post(':id/hold')
  @HttpCode(200)
  @StaffAuth('orders.manage')
  @ApiOkResponse({ type: OrdersAdminDetailDto })
  @ApiConflictResponse()
  async hold(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: OrdersAdminReasonDto,
  ) {
    const orderNo = await this.orders.hold(id, ctx.staff.id, body.reason);
    return this.orders.detail(orderNo);
  }

  @Post(':id/resume')
  @HttpCode(200)
  @StaffAuth('orders.manage')
  @ApiOkResponse({ type: OrdersAdminDetailDto })
  @ApiConflictResponse()
  async resume(@CurrentStaff() ctx: StaffAuthContext, @Param('id') id: string) {
    const orderNo = await this.orders.resume(id, ctx.staff.id);
    return this.orders.detail(orderNo);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @StaffAuth('orders.manage')
  @ApiOkResponse({ type: OrdersAdminDetailDto })
  @ApiConflictResponse()
  async cancel(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: OrdersAdminReasonDto,
  ) {
    const orderId = await this.cancelService.cancel(
      id,
      { type: 'staff', id: ctx.staff.id },
      body.reason,
    );
    return this.orders.detail(orderId);
  }

  @Post(':id/call')
  @HttpCode(200)
  @StaffAuth('orders.call')
  @ApiOkResponse({ type: OrdersAdminDetailDto })
  @ApiConflictResponse()
  async call(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: OrdersAdminCallOutcomeDto,
  ) {
    const { orderId } = await this.queue.outcome(ctx, id, body.outcome, body.note);
    return this.orders.detail(orderId);
  }
}

@NoStore()
@ApiTags('orders-admin')
@Controller('admin/call-queue')
export class CallQueueController {
  constructor(private readonly queue: CallQueueService) {}

  @Get()
  @StaffAuth('orders.call')
  @ApiOkResponse({ type: OrdersAdminListDto })
  list(@Query() q: OrdersAdminCallQueueQueryDto) {
    return this.queue.list(q);
  }

  @Get('count')
  @StaffAuth('orders.call')
  @ApiOkResponse({ type: OrdersAdminCallCountDto })
  count() {
    return this.queue.count();
  }
}

@NoStore()
@ApiTags('orders-admin')
@Controller('admin/couriers')
export class CouriersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: [CourierRowDto] })
  list() {
    return this.prisma.courier.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, isActive: true },
    });
  }
}
