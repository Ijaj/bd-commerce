import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StaffAuth } from '../../auth/staff-auth.guard';
import { CustomerErrorDto } from '../../customers/customers.dto';
import {
  FlashItemsReplaceDto,
  FlashPublicDto,
  FlashSaleCreateDto,
  FlashSaleDetailDto,
  FlashSaleListDto,
  FlashSaleListQueryDto,
  FlashSaleUpdateDto,
} from './flash.dto';
import { FlashAdminService } from './flash-admin.service';
import { FlashPublicService } from './flash-public.service';

@ApiTags('flash-sales-admin')
@Controller('admin/flash-sales')
export class FlashAdminController {
  constructor(private readonly flash: FlashAdminService) {}

  @Get()
  @StaffAuth('flash_sales.manage')
  @ApiOkResponse({ type: FlashSaleListDto })
  list(@Query() q: FlashSaleListQueryDto) {
    return this.flash.list(q);
  }

  @Post()
  @HttpCode(201)
  @StaffAuth('flash_sales.manage')
  @ApiOkResponse({ type: FlashSaleDetailDto })
  create(@Body() body: FlashSaleCreateDto) {
    return this.flash.create(body);
  }

  @Get(':id')
  @StaffAuth('flash_sales.manage')
  @ApiOkResponse({ type: FlashSaleDetailDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.flash.detail(id);
  }

  @Patch(':id')
  @StaffAuth('flash_sales.manage')
  @ApiOkResponse({ type: FlashSaleDetailDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: FlashSaleUpdateDto) {
    return this.flash.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('flash_sales.manage')
  @ApiConflictResponse({ type: CustomerErrorDto })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.flash.remove(id);
  }

  @Put(':id/items')
  @StaffAuth('flash_sales.manage')
  @ApiOkResponse({ type: FlashSaleDetailDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  replaceItems(@Param('id', ParseUUIDPipe) id: string, @Body() body: FlashItemsReplaceDto) {
    return this.flash.replaceItems(id, body);
  }
}

/** Short cache: remaining counts move, but this page should not hit the database per visitor. */
@ApiTags('public')
@Controller('public/flash-sales')
export class FlashPublicController {
  constructor(private readonly flash: FlashPublicService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60')
  @ApiOkResponse({ type: FlashPublicDto })
  current() {
    return this.flash.current();
  }
}
