import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { NoStore } from '../common/no-store.guard';
import { CurrentCustomer, CustomerAuth } from '../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../customers/customer-session.service';
import { CustomerErrorDto } from '../customers/customers.dto';
import { OrderSelfCancelService } from './order-self-cancel.service';
import {
  OrderCancelRequestDto,
  OrderDetailDto,
  OrderTrackCancelRequestDto,
  OrderTrackDto,
} from './orders.dto';

@NoStore()
@ApiTags('customer orders')
@Controller('customer/orders')
export class CustomerOrderCancelController {
  constructor(private readonly cancel: OrderSelfCancelService) {}

  @Post(':orderNo/cancel')
  @HttpCode(200)
  @CustomerAuth()
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  cancelOrder(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('orderNo') orderNo: string,
    @Body() body: OrderCancelRequestDto,
  ): Promise<OrderDetailDto> {
    return this.cancel.forCustomer(ctx.customer.id, orderNo, body.reason);
  }
}

@NoStore()
@ApiTags('order tracking')
@Controller('public/track')
export class TrackCancelController {
  constructor(private readonly cancel: OrderSelfCancelService) {}

  @Post('cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: OrderTrackDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiForbiddenResponse({ type: CustomerErrorDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  cancelOrder(
    @Body() body: OrderTrackCancelRequestDto,
    @Req() req: Request,
  ): Promise<OrderTrackDto> {
    return this.cancel.forGuest(body.orderNo, body.phone, body.reason, clientIp(req));
  }
}
