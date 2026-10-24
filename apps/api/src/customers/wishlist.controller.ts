import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentCustomer, CustomerAuth } from './customer-auth.guard';
import type { CustomerAuthContext } from './customer-auth.service';
import { CustomerErrorDto, OkDto, WishlistDto, WishlistIdsDto } from './customers.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('customer wishlist')
@ApiUnauthorizedResponse({ type: CustomerErrorDto })
@CustomerAuth()
@Controller('customer/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOkResponse({ type: WishlistDto })
  list(@CurrentCustomer() ctx: CustomerAuthContext): Promise<WishlistDto> {
    return this.wishlist.list(ctx.customer.id);
  }

  // Declared before ':productId' so "ids" is never read as a product id.
  @Get('ids')
  @ApiOkResponse({ type: WishlistIdsDto })
  ids(@CurrentCustomer() ctx: CustomerAuthContext): Promise<WishlistIdsDto> {
    return this.wishlist.ids(ctx.customer.id);
  }

  @Put(':productId')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  async add(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<OkDto> {
    await this.wishlist.add(ctx.customer.id, productId);
    return { ok: true };
  }

  @Delete(':productId')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  async remove(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<OkDto> {
    await this.wishlist.remove(ctx.customer.id, productId);
    return { ok: true };
  }
}
