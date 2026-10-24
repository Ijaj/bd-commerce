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
import { StaffAuth } from '../auth/staff-auth.guard';
import {
  CreateSlideDto,
  SlideDto,
  SlideListDto,
  SlideOrderDto,
  UpdateSlideDto,
} from './carousel.dto';
import { CarouselService } from './carousel.service';

@ApiTags('carousel')
@Controller('admin/carousel')
export class CarouselController {
  constructor(private readonly carousel: CarouselService) {}

  @Get()
  @StaffAuth('content.manage')
  @ApiOkResponse({ type: SlideListDto })
  list(): Promise<SlideListDto> {
    return this.carousel.list();
  }

  @Post()
  @StaffAuth('content.manage')
  @ApiCreatedResponse({ type: SlideDto })
  create(@Body() body: CreateSlideDto): Promise<SlideDto> {
    return this.carousel.create(body);
  }

  /** Listed ids go first in the given order; any slides not listed follow. */
  @Put('order')
  @HttpCode(204)
  @StaffAuth('content.manage')
  @ApiNoContentResponse()
  async order(@Body() body: SlideOrderDto) {
    await this.carousel.reorder(body.ids);
  }

  @Patch(':id')
  @StaffAuth('content.manage')
  @ApiOkResponse({ type: SlideDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSlideDto): Promise<SlideDto> {
    return this.carousel.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('content.manage')
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.carousel.remove(id);
  }
}
