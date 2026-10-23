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
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../../auth/staff-auth.guard';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import {
  AttributeDto,
  CategoryDetailDto,
  CategoryDto,
  CategoryListDto,
  CreateAttributeDto,
  CreateCategoryDto,
  DeleteCategoryDto,
  DeletePreviewDto,
  OptionListDto,
  ReorderDto,
  SetOptionsDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
} from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('admin/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Whole tree as a flat list in display order (parents before children, siblings by sort). */
  @Get()
  @StaffAuth('categories.view')
  @ApiOkResponse({ type: CategoryListDto })
  list(): Promise<CategoryDto[]> {
    return this.categories.list();
  }

  @Get(':id')
  @StaffAuth('categories.view')
  @ApiOkResponse({ type: CategoryDetailDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryDetailDto> {
    return this.categories.get(id);
  }

  @Get(':id/delete-preview')
  @StaffAuth('categories.view')
  @ApiOkResponse({ type: DeletePreviewDto })
  deletePreview(@Param('id', ParseUUIDPipe) id: string): Promise<DeletePreviewDto> {
    return this.categories.deletePreview(id);
  }

  @Post()
  @StaffAuth('categories.create')
  @ApiCreatedResponse({ type: CategoryDto })
  create(
    @CurrentStaff() actor: StaffAuthContext,
    @Body() body: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.create(actor, body);
  }

  @Post('reorder')
  @HttpCode(204)
  @StaffAuth('categories.edit')
  @ApiNoContentResponse()
  reorder(@Body() body: ReorderDto) {
    return this.categories.reorder(body);
  }

  @Patch(':id')
  @StaffAuth('categories.edit')
  @ApiOkResponse({ type: CategoryDto })
  update(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(actor, id, body);
  }

  /** `move` needs categories.delete, `cascade` needs categories.delete_with_products (checked per mode). */
  @Delete(':id')
  @HttpCode(204)
  @StaffAuth()
  @ApiNoContentResponse()
  remove(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeleteCategoryDto,
  ) {
    return this.categories.remove(actor, id, body);
  }
}

@ApiTags('categories')
@Controller('admin')
export class AttributesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post('categories/:id/attributes')
  @StaffAuth('categories.edit')
  @ApiCreatedResponse({ type: AttributeDto })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateAttributeDto,
  ): Promise<AttributeDto> {
    return this.categories.createAttribute(id, body);
  }

  @Post('categories/:id/attributes/reorder')
  @HttpCode(204)
  @StaffAuth('categories.edit')
  @ApiNoContentResponse()
  reorder(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReorderDto) {
    return this.categories.reorderAttributes(id, body);
  }

  @Patch('attributes/:attrId')
  @StaffAuth('categories.edit')
  @ApiOkResponse({ type: AttributeDto })
  update(
    @Param('attrId', ParseUUIDPipe) attrId: string,
    @Body() body: UpdateAttributeDto,
  ): Promise<AttributeDto> {
    return this.categories.updateAttribute(attrId, body);
  }

  @Delete('attributes/:attrId')
  @HttpCode(204)
  @StaffAuth('categories.edit')
  @ApiNoContentResponse()
  remove(@Param('attrId', ParseUUIDPipe) attrId: string) {
    return this.categories.removeAttribute(attrId);
  }

  /** Full ordered option list; position in the array becomes `sort`. */
  @Put('attributes/:attrId/options')
  @StaffAuth('categories.edit')
  @ApiOkResponse({ type: OptionListDto })
  setOptions(@Param('attrId', ParseUUIDPipe) attrId: string, @Body() body: SetOptionsDto) {
    return this.categories.setOptions(attrId, body);
  }
}
