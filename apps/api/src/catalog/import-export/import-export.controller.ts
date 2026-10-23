import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  type ApiBodyOptions,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentStaff, StaffAuth } from '../../auth/staff-auth.guard';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { MAX_FILE_BYTES } from './columns';
import { type BuiltFile, ExportService } from './export.service';
import { ImportService } from './import.service';
import {
  ExportQueryDto,
  ImportQueryDto,
  ImportSummaryDto,
  TemplateQueryDto,
} from './import-export.dto';

const FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const;
const binary = { schema: { type: 'string', format: 'binary' } } as const;
const upload: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};
const fileInterceptor = FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

function send(res: Response, f: BuiltFile) {
  res.set({
    'Content-Type': f.contentType,
    'Content-Disposition': `attachment; filename="${f.filename}"`,
  });
  return new StreamableFile(f.buffer);
}

function need(file: { buffer: Buffer } | undefined) {
  if (!file) throw new BadRequestException('Attach an XLSX or CSV file in the "file" field');
  return file.buffer;
}

/** One row per variant; see columns.ts for the layout. */
@ApiTags('import-export')
@Controller('admin/products')
export class ImportExportController {
  constructor(
    private readonly exporter: ExportService,
    private readonly importer: ImportService,
  ) {}

  /** Same filters as the product list. cost_price only with products.view_cost. */
  @Get('export')
  @StaffAuth('products.export')
  @ApiProduces(...FILE_TYPES)
  @ApiOkResponse({
    description: 'XLSX or CSV (UTF-8 with BOM) download',
    content: Object.fromEntries(FILE_TYPES.map((t) => [t, binary])),
  })
  async export(
    @CurrentStaff() actor: StaffAuthContext,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return send(res, await this.exporter.export(actor.permissions, query));
  }

  /** Header row plus two example rows (one product with two variants). */
  @Get('import-template')
  @StaffAuth('products.import')
  @ApiProduces(...FILE_TYPES)
  @ApiOkResponse({
    description: 'XLSX or CSV template',
    content: Object.fromEntries(FILE_TYPES.map((t) => [t, binary])),
  })
  async template(@Query() query: TemplateQueryDto, @Res({ passthrough: true }) res: Response) {
    return send(res, await this.exporter.template(query.format));
  }

  /** Validates the file and reports what would change. Writes nothing. */
  @Post('import/preview')
  @HttpCode(200)
  @StaffAuth('products.import')
  @UseInterceptors(fileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody(upload)
  @ApiOkResponse({ type: ImportSummaryDto })
  preview(
    @CurrentStaff() actor: StaffAuthContext,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Query() query: ImportQueryDto,
  ): Promise<ImportSummaryDto> {
    return this.importer.preview(need(file), query.mode, actor.permissions);
  }

  /** All or nothing: any validation error returns 400 with the error list and writes nothing. */
  @Post('import')
  @HttpCode(200)
  @StaffAuth('products.import')
  @UseInterceptors(fileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody(upload)
  @ApiOkResponse({ type: ImportSummaryDto })
  @ApiBadRequestResponse({
    description:
      'Validation errors as {message, errors: [{row, column, message}], errorCount}; nothing written',
  })
  import(
    @CurrentStaff() actor: StaffAuthContext,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Query() query: ImportQueryDto,
  ): Promise<ImportSummaryDto> {
    return this.importer.run(actor, need(file), query.mode);
  }
}
