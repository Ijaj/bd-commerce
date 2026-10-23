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
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StaffAuth } from '../../auth/staff-auth.guard';
import {
  BrandDto,
  BrandListDto,
  CreateBrandDto,
  DeleteBrandQueryDto,
  UpdateBrandDto,
} from './brands.dto';
import { BrandsService } from './brands.service';

@ApiTags('brands')
@Controller('admin/brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @StaffAuth('products.view')
  @ApiOkResponse({ type: BrandListDto })
  list(): Promise<BrandListDto> {
    return this.brands.list();
  }

  @Post()
  @StaffAuth('products.create')
  @ApiCreatedResponse({ type: BrandDto })
  create(@Body() body: CreateBrandDto): Promise<BrandDto> {
    return this.brands.create(body);
  }

  @Patch(':id')
  @StaffAuth('products.edit')
  @ApiOkResponse({ type: BrandDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateBrandDto): Promise<BrandDto> {
    return this.brands.update(id, body);
  }

  /** 409 when products use the brand, unless `?force=true` (detaches them). */
  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('products.delete')
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: DeleteBrandQueryDto) {
    await this.brands.remove(id, query.force === 'true');
  }
}
