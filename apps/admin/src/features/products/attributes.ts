import type { AttributeValueRow, CategoryAttribute } from './types';

/** Editor state for one attribute; which fields apply depends on the attribute type. */
export interface AttrValue {
  text?: string;
  number?: number | null;
  bool?: boolean | null;
  optionIds?: string[];
}
export type AttrValues = Record<string, AttrValue>;

export interface AttributePayloadRow {
  attributeId: string;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  optionIds?: string[];
}

/**
 * Attributes that apply to a product in the given categories: each category's own and inherited
 * ones, deduped by attribute id, in first-seen order (ancestors' attributes come first).
 */
export interface AttributeSource {
  attributes: CategoryAttribute[];
  inheritedAttributes: CategoryAttribute[];
}

export function mergeAttributes(details: readonly AttributeSource[]): CategoryAttribute[] {
  const seen = new Set<string>();
  const out: CategoryAttribute[] = [];
  for (const d of details) {
    for (const a of [...d.inheritedAttributes, ...d.attributes]) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

export function valuesFromDetail(rows: readonly AttributeValueRow[]): AttrValues {
  const out: AttrValues = {};
  for (const r of rows) {
    out[r.attributeId] = {
      text: r.valueText ?? undefined,
      number: r.valueNumber,
      bool: r.valueBool,
      optionIds: r.optionIds,
    };
  }
  return out;
}

export function isAttrEmpty(attr: CategoryAttribute, v: AttrValue | undefined): boolean {
  if (!v) return true;
  switch (attr.type) {
    case 'text':
      return !v.text?.trim();
    case 'number':
      return v.number === null || v.number === undefined;
    case 'boolean':
      return v.bool === null || v.bool === undefined;
    default:
      return !v.optionIds?.length;
  }
}

/** Only attributes that apply to the current categories and have a value are sent. */
export function buildAttributePayload(
  attrs: readonly CategoryAttribute[],
  values: AttrValues,
): AttributePayloadRow[] {
  const out: AttributePayloadRow[] = [];
  for (const a of attrs) {
    const v = values[a.id];
    if (isAttrEmpty(a, v) || !v) continue;
    if (a.type === 'text') out.push({ attributeId: a.id, valueText: (v.text ?? '').trim() });
    else if (a.type === 'number') out.push({ attributeId: a.id, valueNumber: v.number as number });
    else if (a.type === 'boolean') out.push({ attributeId: a.id, valueBool: v.bool as boolean });
    else {
      const valid = new Set(a.options.map((o) => o.id));
      const ids = (v.optionIds ?? []).filter((id) => valid.has(id));
      out.push({
        attributeId: a.id,
        optionIds: a.type === 'select' ? ids.slice(0, 1) : ids,
      });
    }
  }
  return out.filter((r) => r.optionIds === undefined || r.optionIds.length > 0);
}

export function missingRequired(
  attrs: readonly CategoryAttribute[],
  values: AttrValues,
): CategoryAttribute[] {
  return attrs.filter((a) => a.isRequired && isAttrEmpty(a, values[a.id]));
}
