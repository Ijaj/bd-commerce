import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { ShipmentBookingService } from './shipment-booking.service';
import { ShipmentSyncService } from './shipment-sync.service';
import {
  ShipmentBookDto,
  ShipmentCancelDto,
  ShipmentCreateDto,
  ShipmentDetailDto,
  ShipmentDto,
  ShipmentListDto,
  ShipmentListQueryDto,
  ShipmentOrderListDto,
  ShipmentRebookDto,
  ShipmentSyncResultDto,
  ShipmentWebhookAckDto,
} from './shipments.dto';
import { ShipmentError } from './shipments.errors';
import { ShipmentsService } from './shipments.service';

/** Reads of one order's shipments need orders.view; everything else shipments.manage. */
@ApiTags('shipments-admin')
@Controller('admin')
export class ShipmentsAdminController {
  constructor(
    private readonly shipments: ShipmentsService,
    private readonly booking: ShipmentBookingService,
    private readonly sync: ShipmentSyncService,
  ) {}

  @Get('orders/:id/shipments')
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: ShipmentOrderListDto })
  forOrder(@Param('id') id: string) {
    return this.shipments.forOrder(id);
  }

  @Post('orders/:id/shipments')
  @HttpCode(201)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentDto })
  create(@Param('id') id: string, @Body() body: ShipmentCreateDto) {
    return this.shipments.create(id, body);
  }

  @Get('shipments')
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentListDto })
  list(@Query() q: ShipmentListQueryDto) {
    return this.shipments.list(q);
  }

  @Get('shipments/:id')
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentDetailDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.shipments.detail(id);
  }

  @Post('shipments/:id/cancel')
  @HttpCode(200)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentDto })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: ShipmentCancelDto) {
    return this.booking.cancel(id, body);
  }

  @Post('shipments/:id/book')
  @HttpCode(200)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentDto })
  book(@Param('id', ParseUUIDPipe) id: string, @Body() body: ShipmentBookDto) {
    return this.booking.book(id, body.courierCode);
  }

  @Post('shipments/:id/rebook')
  @HttpCode(200)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentDto })
  rebook(@Param('id', ParseUUIDPipe) id: string, @Body() body: ShipmentRebookDto) {
    return this.booking.rebook(id, body);
  }

  @Post('shipments/:id/handover')
  @HttpCode(200)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentDto })
  handover(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.booking.handover(id, ctx.staff.id);
  }

  @Post('shipments/:id/sync')
  @HttpCode(200)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: ShipmentSyncResultDto })
  syncOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.sync(id);
  }
}

/** Couriers call this with their own secret; no cookie, no CSRF concerns. */
@ApiTags('courier-webhooks')
@Controller('public/courier-webhooks')
export class CourierWebhookController {
  constructor(private readonly sync: ShipmentSyncService) {}

  @Post(':code')
  @HttpCode(200)
  @ApiOkResponse({ type: ShipmentWebhookAckDto })
  async receive(
    @Param('code') code: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    const res = await this.sync.webhook(code, headers, body);
    if (!res.authorized)
      throw new ShipmentError(401, 'COURIER_WEBHOOK_UNAUTHORIZED', 'Unauthorized');
    return { ok: true as const };
  }
}
