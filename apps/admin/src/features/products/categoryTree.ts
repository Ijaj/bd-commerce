import type { CategoryNode } from './types';

export interface SelectOption {
  value: string;
  label: string;
}

/** The API returns categories depth-first; indent by level for Select/MultiSelect labels. */
export function categoryOptions(categories: CategoryNode[] | undefined): SelectOption[] {
  return (categories ?? []).map((c) => ({
    value: c.id,
    label: `${'   '.repeat(Math.max(0, c.level - 1))}${c.level > 1 ? '↳ ' : ''}${c.nameEn}`,
  }));
}
