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
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { MediaDto, UpdateMediaDto, UploadMediaDto } from './media.dto';
import { MAX_UPLOAD_BYTES, MediaService } from './media.service';

@ApiTags('media')
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** JPEG, PNG, WebP, AVIF or GIF up to 10 MB. Needs products.edit or categories.edit. */
  @Post()
  @StaffAuth()
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
    this.media.assertCanManage(actor);
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    return this.media.upload(actor, file.buffer, body.alt);
  }

  @Get(':id')
  @StaffAuth()
  @ApiOkResponse({ type: MediaDto })
  get(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaDto> {
    this.media.assertCanManage(actor);
    return this.media.get(id);
  }

  @Patch(':id')
  @StaffAuth()
  @ApiOkResponse({ type: MediaDto })
  update(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMediaDto,
  ): Promise<MediaDto> {
    this.media.assertCanManage(actor);
    return this.media.update(id, body.alt);
  }

  /** 409 while a product, brand or category still uses the image. */
  @Delete(':id')
  @HttpCode(204)
  @StaffAuth()
  @ApiNoContentResponse()
  remove(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.media.assertCanManage(actor);
    return this.media.remove(id);
  }
}
