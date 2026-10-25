import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { NoStore } from '../common/no-store.guard';
import { CustomerErrorDto } from '../customers/customers.dto';
import { CartCouponCodeDto, CartCouponSuggestionsDto, CartDto, CartSetQtyDto } from './cart.dto';
import { CartService } from './cart.service';
import { CartCouponsService } from './cart-coupons.service';
import { CartIdentityService } from './cart-identity.service';

@ApiTags('cart')
@NoStore()
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly identity: CartIdentityService,
    private readonly coupons: CartCouponsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: CartDto })
  async get(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CartDto> {
    return this.cart.view(await this.identity.resolve(req, res));
  }

  @Put('items/:variantId')
  @ApiOkResponse({ type: CartDto })
  @ApiBadRequestResponse({ type: CustomerErrorDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  async setQty(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: CartSetQtyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    return this.cart.setQty(await this.identity.resolve(req, res), variantId, body.qty);
  }

  @Delete('items/:variantId')
  @ApiOkResponse({ type: CartDto })
  async remove(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    return this.cart.remove(await this.identity.resolve(req, res), variantId);
  }

  @Post('coupon')
  @HttpCode(200)
  @ApiOkResponse({ type: CartDto })
  @ApiUnprocessableEntityResponse({ type: CustomerErrorDto })
  async addCoupon(
    @Body() body: CartCouponCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    return this.coupons.applyCode(await this.identity.resolve(req, res), body.code);
  }

  @Delete('coupon/:code')
  @ApiOkResponse({ type: CartDto })
  async removeCoupon(
    @Param('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    return this.coupons.removeCode(await this.identity.resolve(req, res), code);
  }

  /** Code coupons the customer could add, with what each would save on the current cart. */
  @Get('coupon-suggestions')
  @ApiOkResponse({ type: CartCouponSuggestionsDto })
  async suggestions(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartCouponSuggestionsDto> {
    return { items: await this.coupons.suggestions(await this.identity.resolve(req, res)) };
  }

  @Delete()
  @ApiOkResponse({ type: CartDto })
  async clear(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CartDto> {
    return this.cart.clear(await this.identity.resolve(req, res));
  }
}
