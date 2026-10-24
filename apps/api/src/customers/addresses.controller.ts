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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NoStore } from '../common/no-store.guard';
import { AddressDto, AddressListDto, CreateAddressDto, UpdateAddressDto } from './addresses.dto';
import { AddressesService } from './addresses.service';
import { CurrentCustomer, CustomerAuth } from './customer-auth.guard';
import type { CustomerAuthContext } from './customer-session.service';
import { CustomerErrorDto } from './customers.dto';

@ApiTags('customer addresses')
@ApiBadRequestResponse({ type: CustomerErrorDto })
@ApiNotFoundResponse({ type: CustomerErrorDto })
@CustomerAuth()
@NoStore()
@Controller('customer/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOkResponse({ type: AddressListDto })
  list(@CurrentCustomer() ctx: CustomerAuthContext): Promise<AddressListDto> {
    return this.addresses.list(ctx.customer.id);
  }

  @Post()
  @ApiCreatedResponse({ type: AddressDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  create(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Body() body: CreateAddressDto,
  ): Promise<AddressDto> {
    return this.addresses.create(ctx.customer.id, body);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AddressDto })
  update(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAddressDto,
  ): Promise<AddressDto> {
    return this.addresses.update(ctx.customer.id, id, body);
  }

  @Put(':id/default')
  @ApiOkResponse({ type: AddressDto })
  setDefault(
    @CurrentCustomer() ctx: CustomerAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AddressDto> {
    return this.addresses.setDefault(ctx.customer.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentCustomer() ctx: CustomerAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.addresses.remove(ctx.customer.id, id);
  }
}
