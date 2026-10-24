import type { ZoneBody } from './queries';

/** Q105: null = never free, 0 = always free, otherwise free once the subtotal reaches it. */
export type FreeMode = 'never' | 'always' | 'above';

export function freeModeOf(freeAboveP: number | null): FreeMode {
  return freeAboveP === null ? 'never' : freeAboveP === 0 ? 'always' : 'above';
}

/** Mode + typed amount -> the API value, or an error for "above" without an amount. */
export function freeAboveFrom(
  mode: FreeMode,
  amountP: number | null,
): { value: number | null } | { error: string } {
  if (mode === 'never') return { value: null };
  if (mode === 'always') return { value: 0 };
  if (!amountP || amountP <= 0) return { error: 'Enter an amount above zero' };
  return { value: amountP };
}

export function freeLabel(freeAboveP: number | null, fmt: (p: number) => string): string {
  if (freeAboveP === null) return 'Never free';
  if (freeAboveP === 0) return 'Always free';
  return `Above ${fmt(freeAboveP)}`;
}

export const gramsToKg = (g: number) => g / 1000;
export const kgToGrams = (kg: number) => Math.round(kg * 1000);

export interface ZoneFormValues {
  nameEn: string;
  nameBn: string;
  baseChargeP: number | null;
  baseWeightKg: number | '';
  extraPerKgP: number | null;
  etaMinDays: number | '';
  etaMaxDays: number | '';
  freeMode: FreeMode;
  freeAmountP: number | null;
  isDefault: boolean;
}

export function zoneBody(v: ZoneFormValues): ZoneBody {
  const free = freeAboveFrom(v.freeMode, v.freeAmountP);
  return {
    nameEn: v.nameEn.trim(),
    nameBn: v.nameBn.trim() || null,
    baseChargeP: v.baseChargeP ?? 0,
    baseWeightG: kgToGrams(Number(v.baseWeightKg || 0)),
    extraPerKgP: v.extraPerKgP ?? 0,
    etaMinDays: Number(v.etaMinDays || 0),
    etaMaxDays: Number(v.etaMaxDays || 0),
    freeAboveP: 'value' in free ? free.value : null,
    isDefault: v.isDefault,
  };
}
