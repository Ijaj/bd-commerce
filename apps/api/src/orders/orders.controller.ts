import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentCustomer, CustomerAuth } from '../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../customers/customer-session.service';
import { CustomerErrorDto } from '../customers/customers.dto';
import {
  OrderDetailDto,
  OrderListDto,
  OrderListQueryDto,
  OrderTrackDto,
  OrderTrackQueryDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('customer orders')
@Controller('customer/orders')
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @CustomerAuth()
  @ApiOkResponse({ type: OrderListDto })
  list(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Query() q: OrderListQueryDto,
  ): Promise<OrderListDto> {
    return this.orders.list(ctx.customer.id, q);
  }

  @Get(':orderNo')
  @CustomerAuth()
  @ApiOkResponse({ type: OrderDetailDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  detail(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('orderNo') orderNo: string,
  ): Promise<OrderDetailDto> {
    return this.orders.detail(ctx.customer.id, orderNo);
  }
}

@ApiTags('order tracking')
@Controller('public/track')
export class TrackController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOkResponse({ type: OrderTrackDto })
  @ApiBadRequestResponse({ type: CustomerErrorDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiTooManyRequestsResponse({ type: CustomerErrorDto })
  track(@Query() q: OrderTrackQueryDto, @Req() req: Request): Promise<OrderTrackDto> {
    const cfIp = req.headers['cf-connecting-ip'];
    return this.orders.track(
      q.orderNo,
      q.phone,
      (typeof cfIp === 'string' ? cfIp : undefined) ?? req.ip,
    );
  }
}
