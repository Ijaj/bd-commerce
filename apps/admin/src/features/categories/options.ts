import type { OptionInput } from './types';

export interface OptionRow {
  /** Stable React / dnd key. */
  key: string;
  /** Present for options that already exist on the server. */
  id?: string;
  valueEn: string;
  valueBn: string;
}

export type OptionField = 'valueEn' | 'valueBn';

export interface OptionProblem {
  index: number;
  field: OptionField;
  reason: 'blank' | 'duplicate';
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Q116: English may not be blank; values must be unique per language, ignoring case. Every row of a
 * duplicate group is flagged so both can be highlighted. Blank Bangla is fine (falls back to English).
 */
export function validateOptions(rows: Pick<OptionRow, 'valueEn' | 'valueBn'>[]): OptionProblem[] {
  const problems: OptionProblem[] = [];
  const groups: Record<OptionField, Map<string, number[]>> = {
    valueEn: new Map(),
    valueBn: new Map(),
  };
  rows.forEach((row, index) => {
    if (!row.valueEn.trim()) problems.push({ index, field: 'valueEn', reason: 'blank' });
    for (const field of ['valueEn', 'valueBn'] as const) {
      const v = norm(row[field]);
      if (!v) continue;
      groups[field].set(v, [...(groups[field].get(v) ?? []), index]);
    }
  });
  for (const field of ['valueEn', 'valueBn'] as const) {
    for (const indexes of groups[field].values()) {
      if (indexes.length > 1) {
        for (const index of indexes) problems.push({ index, field, reason: 'duplicate' });
      }
    }
  }
  return problems.sort((a, b) => a.index - b.index);
}

/** Problem lookup for rendering: "index:field" -> reason. */
export function problemMap(problems: OptionProblem[]): Map<string, OptionProblem['reason']> {
  return new Map(problems.map((p) => [`${p.index}:${p.field}`, p.reason]));
}

/** Full ordered list for PUT attributes/:id/options. */
export function toOptionPayload(rows: OptionRow[]): OptionInput[] {
  return rows.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    valueEn: r.valueEn.trim(),
    valueBn: r.valueBn.trim() || null,
  }));
}

/** Server-side 400 rows -> problems (ignores shapes it does not understand). */
export function problemsFromServer(rows: unknown): OptionProblem[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    const row = r as { index?: unknown; field?: unknown; reason?: unknown };
    if (typeof row.index !== 'number') return [];
    if (row.field !== 'valueEn' && row.field !== 'valueBn') return [];
    if (row.reason !== 'blank' && row.reason !== 'duplicate') return [];
    return [{ index: row.index, field: row.field, reason: row.reason }];
  });
}
