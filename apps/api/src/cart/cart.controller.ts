import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { NoStore } from '../common/no-store.guard';
import { CustomerErrorDto } from '../customers/customers.dto';
import { CartDto, CartSetQtyDto } from './cart.dto';
import { CartService } from './cart.service';
import { CartIdentityService } from './cart-identity.service';

@ApiTags('cart')
@NoStore()
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly identity: CartIdentityService,
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

  @Delete()
  @ApiOkResponse({ type: CartDto })
  async clear(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CartDto> {
    return this.cart.clear(await this.identity.resolve(req, res));
  }
}
