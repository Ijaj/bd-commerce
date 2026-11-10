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
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StaffAuth } from '../auth/staff-auth.guard';
import {
  PageCreateDto,
  PageFullDto,
  PageListDto,
  PageUpdateDto,
  PublicPageDto,
  PublicPageListDto,
} from './pages.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@Controller('admin/pages')
export class PagesAdminController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @StaffAuth('content.manage')
  @ApiOkResponse({ type: PageListDto })
  async list(): Promise<PageListDto> {
    return { items: await this.pages.list() };
  }

  @Get(':id')
  @StaffAuth('content.manage')
  @ApiOkResponse({ type: PageFullDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<PageFullDto> {
    return this.pages.get(id);
  }

  @Post()
  @StaffAuth('content.manage')
  @ApiCreatedResponse({ type: PageFullDto })
  create(@Body() body: PageCreateDto): Promise<PageFullDto> {
    return this.pages.create(body);
  }

  @Patch(':id')
  @StaffAuth('content.manage')
  @ApiOkResponse({ type: PageFullDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PageUpdateDto,
  ): Promise<PageFullDto> {
    return this.pages.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('content.manage')
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.pages.remove(id);
  }
}

@ApiTags('public')
@Controller('public/pages')
export class PagesPublicController {
  constructor(private readonly pages: PagesService) {}

  /** Footer links: published pages flagged show-in-footer. */
  @Get()
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOkResponse({ type: PublicPageListDto })
  list(): Promise<PublicPageListDto> {
    return this.pages.publicList();
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOkResponse({ type: PublicPageDto })
  get(@Param('slug') slug: string): Promise<PublicPageDto> {
    return this.pages.publicGet(slug);
  }
}
