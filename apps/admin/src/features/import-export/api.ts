import { errorMessage } from '~/api';
import { parseContentDisposition } from './filename';

export type FileFormat = 'xlsx' | 'csv';
export type ImportMode = 'upsert' | 'create_only';

export interface ImportIssue {
  row: number;
  column: string;
  message: string;
}

interface Counts {
  create: number;
  update: number;
  unchanged: number;
}

/** Response of POST products/import and products/import/preview. */
export interface ImportSummary {
  rows: number;
  products: Counts;
  variants: Counts;
  stockMovements: number;
  errors: ImportIssue[];
  errorCount: number;
  warnings: ImportIssue[];
}

/** Thrown for a rejected import; `issues` is set when the API sent a validation error list. */
export class ImportRequestError extends Error {
  constructor(
    message: string,
    readonly issues: ImportIssue[] = [],
    readonly errorCount = issues.length,
  ) {
    super(message);
    this.name = 'ImportRequestError';
  }
}

function isIssue(v: unknown): v is ImportIssue {
  const i = v as ImportIssue | null;
  return !!i && typeof i === 'object' && typeof i.row === 'number' && typeof i.message === 'string';
}

async function failure(res: Response, fallback: string): Promise<Error> {
  const body: unknown = await res.json().catch(() => null);
  const b = body as { errors?: unknown; errorCount?: unknown } | null;
  if (b && Array.isArray(b.errors) && b.errors.length > 0 && b.errors.every(isIssue)) {
    const count = typeof b.errorCount === 'number' ? b.errorCount : b.errors.length;
    return new ImportRequestError(errorMessage(null, 'The file has errors'), b.errors, count);
  }
  return new ImportRequestError(errorMessage(body, `${fallback} (${res.status})`));
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** GET a file with the session cookie and hand it to the browser. Returns the saved file name. */
export async function downloadFile(
  path: string,
  params: Record<string, string | undefined>,
  fallbackName: string,
): Promise<string> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const res = await fetch(`${path}?${qs}`, { credentials: 'include' });
  if (!res.ok) throw await failure(res, 'Download failed');
  const filename = parseContentDisposition(res.headers.get('Content-Disposition'), fallbackName);
  saveBlob(await res.blob(), filename);
  return filename;
}

/** Multipart upload of the sheet; `preview` validates only, otherwise the import is written. */
export async function submitImport(
  file: File,
  mode: ImportMode,
  preview: boolean,
): Promise<ImportSummary> {
  const body = new FormData();
  body.append('file', file);
  const url = `/v1/admin/products/import${preview ? '/preview' : ''}?mode=${mode}`;
  const res = await fetch(url, { method: 'POST', body, credentials: 'include' });
  if (!res.ok) throw await failure(res, preview ? 'Check failed' : 'Import failed');
  return (await res.json()) as ImportSummary;
}
