import type { components } from '@bdc/api-client';

type S = components['schemas'];

export type AttributeType = S['AttributeDto']['type'];

export const ATTRIBUTE_TYPES: { value: AttributeType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select (one)' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'boolean', label: 'Yes / No' },
];

export const hasOptions = (t: AttributeType) => t === 'select' || t === 'multiselect';

export type Category = S['CategoryDto'];
export type CategoryDetail = S['CategoryDetailDto'];
export type Attribute = S['AttributeDto'];
export type InheritedAttribute = CategoryDetail['inheritedAttributes'][number];
export type AttributeOption = S['OptionListDto'][number];
export type DeletePreview = S['DeletePreviewDto'];
export type CategoryInput = S['CreateCategoryDto'];
export type CreateAttributeInput = S['CreateAttributeDto'];
export type AttributeInput = S['UpdateAttributeDto'];
export type OptionInput = S['SetOptionsDto'][number];

// Error bodies are not in the OpenAPI spec, so these stay hand-written.

/** 409 from DELETE categories/:id (cascade) when products have stock history. */
export interface CascadeBlockedBody {
  message: string;
  products: { id: string; titleEn: string }[];
}

/** 409 from PUT attributes/:id/options when removed options are in use. */
export interface OptionUsageBody {
  message: string;
  usage: { optionId: string; valueEn: string; productCount: number }[];
}

/** 409 from PATCH/DELETE attributes/:id (type change / delete) when products hold values. */
export interface AttributeUsageBody {
  message: string;
  valueCount: number;
  productCount: number;
}

/** 400 from PUT attributes/:id/options. */
export interface OptionProblemsBody {
  message: string;
  rows?: { index: number; field: string; reason: string }[];
}
