import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { NoStore } from '../common/no-store.guard';
import { CurrentCustomer, CustomerAuth } from '../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../customers/customer-session.service';
import { CustomerErrorDto } from '../customers/customers.dto';
import {
  OrderDetailDto,
  OrderListDto,
  OrderListQueryDto,
  OrderTrackDto,
  OrderTrackRequestDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

@NoStore()
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

@NoStore()
@ApiTags('order tracking')
@Controller('public/track')
export class TrackController {
  constructor(private readonly orders: OrdersService) {}

  /** POST so the phone number never lands in URLs, logs or browser history. */
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: OrderTrackDto })
  @ApiBadRequestResponse({ type: CustomerErrorDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiTooManyRequestsResponse({ type: CustomerErrorDto })
  track(@Body() body: OrderTrackRequestDto, @Req() req: Request): Promise<OrderTrackDto> {
    return this.orders.track(body.orderNo, body.phone, clientIp(req));
  }
}
