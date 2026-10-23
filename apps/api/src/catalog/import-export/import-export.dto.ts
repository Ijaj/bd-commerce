import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const uuid = z.uuid();
const format = z.enum(['xlsx', 'csv']).default('xlsx');

export class ExportQueryDto extends createZodDto(
  z.object({
    format,
    q: z.string().trim().max(100).optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    categoryId: uuid.optional(),
    brandId: uuid.optional(),
  }),
) {}

export class TemplateQueryDto extends createZodDto(z.object({ format })) {}

export class ImportQueryDto extends createZodDto(
  z.object({ mode: z.enum(['upsert', 'create_only']).default('upsert') }),
) {}

const counts = z.object({
  create: z.number().int(),
  update: z.number().int(),
  unchanged: z.number().int(),
});

const issue = z.object({
  /** Spreadsheet row, header = 1. */
  row: z.number().int(),
  column: z.string(),
  message: z.string(),
});

export class ImportSummaryDto extends createZodDto(
  z.object({
    rows: z.number().int(),
    products: counts,
    variants: counts,
    stockMovements: z.number().int(),
    errors: z.array(issue),
    /** Total errors; `errors` lists at most the first 500. */
    errorCount: z.number().int(),
    warnings: z.array(issue),
  }),
) {}

export type ImportIssue = z.infer<typeof issue>;
