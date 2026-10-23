import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export type CellValue = string | number | null;

export interface SheetData {
  headers: string[];
  /** 1-based spreadsheet row numbers (header = 1). */
  rows: { row: number; cells: string[] }[];
}

const XLSX_LIMIT = 32_767;

export function detectFormat(buf: Buffer): 'xlsx' | 'csv' {
  return buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b ? 'xlsx' : 'csv';
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if ('richText' in v)
    return v.richText
      .map((t) => t.text)
      .join('')
      .trim();
  if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text).trim();
  if ('error' in v) return '';
  return '';
}

export async function readXlsx(buf: Buffer): Promise<SheetData> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('The file is not a readable XLSX workbook');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException('The workbook has no sheets');
  const width = ws.columnCount;
  const all: { row: number; cells: string[] }[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let i = 1; i <= width; i++) cells.push(cellText(row.getCell(i).value));
    all.push({ row: rowNumber, cells });
  });
  return splitHeader(all);
}

/** RFC 4180 reader: quoted fields, doubled quotes, embedded newlines, optional BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      out.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

export function readCsv(buf: Buffer): SheetData {
  const records = parseCsv(buf.toString('utf8'));
  return splitHeader(
    records.map((cells, i) => ({ row: i + 1, cells: cells.map((x) => x.trim()) })),
  );
}

function splitHeader(all: { row: number; cells: string[] }[]): SheetData {
  const nonEmpty = all.filter((r) => r.cells.some((c) => c !== ''));
  const head = nonEmpty[0];
  if (!head) throw new BadRequestException('The file is empty');
  return {
    headers: head.cells.map((h) => h.toLowerCase()),
    rows: nonEmpty.slice(1),
  };
}

export async function readSheet(buf: Buffer): Promise<SheetData> {
  return detectFormat(buf) === 'xlsx' ? readXlsx(buf) : readCsv(buf);
}

// ---- writing -----------------------------------------------------------------------------------

const csvField = (v: CellValue): string => {
  const s = v === null ? '' : String(v);
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replaceAll('"', '""')}"` : s;
};

/** UTF-8 with BOM so Excel shows Bangla correctly. */
export function writeCsv(headers: string[], rows: CellValue[][]): Buffer {
  const lines = [headers, ...rows].map((r) => r.map(csvField).join(','));
  return Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8');
}

export interface ExtraSheet {
  name: string;
  headers: string[];
  rows: CellValue[][];
}

export async function writeXlsx(
  headers: string[],
  rows: CellValue[][],
  priceColumns: Set<string>,
  extra?: ExtraSheet,
): Promise<Buffer> {
  for (const r of rows) {
    for (const v of r) {
      if (typeof v === 'string' && v.length > XLSX_LIMIT) {
        throw new BadRequestException(
          'A cell is longer than Excel allows (32,767 characters); export as CSV instead',
        );
      }
    }
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Products', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(headers).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(Math.max(h.length + 2, 12), 40);
    if (priceColumns.has(h)) col.numFmt = '0.00';
  });
  if (extra) {
    const es = wb.addWorksheet(extra.name);
    es.addRow(extra.headers).font = { bold: true };
    for (const r of extra.rows) es.addRow(r);
    extra.headers.forEach((_, i) => {
      es.getColumn(i + 1).width = i === 2 ? 70 : 24;
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
