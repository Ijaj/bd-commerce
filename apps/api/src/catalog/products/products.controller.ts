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
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../../auth/staff-auth.guard';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import {
  CreateProductDto,
  ListProductsQueryDto,
  ProductDetailDto,
  ProductListDto,
  SetImagesDto,
  SetVariantsDto,
  UpdateProductDto,
} from './products.dto';
import { ProductsService } from './products.service';

const uuid = new ParseUUIDPipe();

/** Every write returns the full product detail. */
@ApiTags('products')
@Controller('admin/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @StaffAuth('products.view')
  @ApiOkResponse({ type: ProductListDto })
  list(@Query() query: ListProductsQueryDto): Promise<ProductListDto> {
    return this.products.list(query);
  }

  @Get(':id')
  @StaffAuth('products.view')
  @ApiOkResponse({ type: ProductDetailDto })
  detail(@CurrentStaff() actor: StaffAuthContext, @Param('id', uuid) id: string) {
    return this.products.detail(actor, id);
  }

  @Post()
  @StaffAuth('products.create')
  @ApiCreatedResponse({ type: ProductDetailDto })
  create(@CurrentStaff() actor: StaffAuthContext, @Body() body: CreateProductDto) {
    return this.products.create(actor, body);
  }

  @Patch(':id')
  @StaffAuth('products.edit')
  @ApiOkResponse({ type: ProductDetailDto })
  update(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', uuid) id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.products.update(actor, id, body);
  }

  /** Full desired state of options and variants. Price fields need products.edit_price. */
  @Put(':id/variants')
  @StaffAuth('products.edit')
  @ApiOkResponse({ type: ProductDetailDto })
  setVariants(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', uuid) id: string,
    @Body() body: SetVariantsDto,
  ) {
    return this.products.setVariants(actor, id, body);
  }

  /** Full ordered image list; variantId null = shared. */
  @Put(':id/images')
  @StaffAuth('products.edit')
  @ApiOkResponse({ type: ProductDetailDto })
  setImages(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', uuid) id: string,
    @Body() body: SetImagesDto,
  ) {
    return this.products.setImages(actor, id, body.images);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @StaffAuth('products.publish')
  @ApiOkResponse({ type: ProductDetailDto })
  publish(@CurrentStaff() actor: StaffAuthContext, @Param('id', uuid) id: string) {
    return this.products.publish(actor, id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @StaffAuth('products.publish')
  @ApiOkResponse({ type: ProductDetailDto })
  unpublish(@CurrentStaff() actor: StaffAuthContext, @Param('id', uuid) id: string) {
    return this.products.unpublish(actor, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @StaffAuth('products.delete')
  @ApiOkResponse({ type: ProductDetailDto })
  archive(@CurrentStaff() actor: StaffAuthContext, @Param('id', uuid) id: string) {
    return this.products.archive(actor, id);
  }

  @Post(':id/duplicate')
  @StaffAuth('products.create')
  @ApiCreatedResponse({ type: ProductDetailDto })
  duplicate(@CurrentStaff() actor: StaffAuthContext, @Param('id', uuid) id: string) {
    return this.products.duplicate(actor, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('products.delete')
  @ApiNoContentResponse()
  async remove(@Param('id', uuid) id: string) {
    await this.products.remove(id);
  }
}
