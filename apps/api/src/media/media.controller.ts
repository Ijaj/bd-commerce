import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentStaff } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { MediaDto, UpdateMediaDto, UploadMediaDto } from './media.dto';
import { MediaAuth } from './media.guard';
import { MAX_UPLOAD_BYTES, MediaService } from './media.service';

@ApiTags('media')
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** JPEG, PNG, WebP, AVIF or GIF up to 10 MB. Needs products.edit or categories.edit. */
  @Post()
  @MediaAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string', maxLength: 300 },
      },
    },
  })
  @ApiCreatedResponse({ type: MediaDto })
  upload(
    @CurrentStaff() actor: StaffAuthContext,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: UploadMediaDto,
  ): Promise<MediaDto> {
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    return this.media.upload(actor, file.buffer, body.alt);
  }

  @Get(':id')
  @MediaAuth()
  @ApiOkResponse({ type: MediaDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<MediaDto> {
    return this.media.get(id);
  }

  @Patch(':id')
  @MediaAuth()
  @ApiOkResponse({ type: MediaDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateMediaDto): Promise<MediaDto> {
    return this.media.update(id, body.alt);
  }

  /** 409 while a product, brand or category still uses the image. */
  @Delete(':id')
  @HttpCode(204)
  @MediaAuth()
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.media.remove(id);
  }
}
