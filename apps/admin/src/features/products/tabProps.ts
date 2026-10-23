import type { ProductForm } from './payload';

export interface FormTabProps {
  form: ProductForm;
  set: (patch: Partial<ProductForm>) => void;
  disabled: boolean;
}

/** Mantine NumberInput value -> number|null. */
export const numOrNull = (v: number | string): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
