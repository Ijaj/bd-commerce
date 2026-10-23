import { type AttributePayloadRow, type AttrValues, buildAttributePayload } from './attributes';
import type { CategoryAttribute, Fulfillment, ProductDetail } from './types';

export interface ProductForm {
  titleEn: string;
  titleBn: string;
  slug: string;
  shortEn: string;
  shortBn: string;
  descEn: string;
  descBn: string;
  youtubeUrl: string;
  brandId: string | null;
  primaryCategoryId: string | null;
  /** Additional categories; the primary one is not repeated here. */
  extraCategoryIds: string[];
  fulfillment: Fulfillment;
  weightG: number | null;
  deliveryChargeOverrideP: number | null;
  returnWindowDays: number | null;
  isPreorder: boolean;
  /** 'YYYY-MM-DD' */
  preorderExpectedDate: string | null;
  isUpcoming: boolean;
  advancePercent: number | null;
  isPinned: boolean;
  pinBoost: number;
  seoTitle: string;
  seoDescription: string;
  attributes: AttrValues;
}

export const emptyForm = (): ProductForm => ({
  titleEn: '',
  titleBn: '',
  slug: '',
  shortEn: '',
  shortBn: '',
  descEn: '',
  descBn: '',
  youtubeUrl: '',
  brandId: null,
  primaryCategoryId: null,
  extraCategoryIds: [],
  fulfillment: 'stock',
  weightG: null,
  deliveryChargeOverrideP: null,
  returnWindowDays: null,
  isPreorder: false,
  preorderExpectedDate: null,
  isUpcoming: false,
  advancePercent: null,
  isPinned: false,
  pinBoost: 0,
  seoTitle: '',
  seoDescription: '',
  attributes: {},
});

export function formFromDetail(d: ProductDetail, attributes: AttrValues): ProductForm {
  return {
    titleEn: d.titleEn,
    titleBn: d.titleBn ?? '',
    slug: d.slug,
    shortEn: d.shortDescriptionEn ?? '',
    shortBn: d.shortDescriptionBn ?? '',
    descEn: d.descriptionHtmlEn ?? '',
    descBn: d.descriptionHtmlBn ?? '',
    youtubeUrl: d.youtubeUrl ?? '',
    brandId: d.brandId,
    primaryCategoryId: d.primaryCategoryId,
    extraCategoryIds: d.categories.filter((c) => !c.isPrimary).map((c) => c.id),
    fulfillment: d.fulfillment,
    weightG: d.weightG,
    deliveryChargeOverrideP: d.deliveryChargeOverrideP,
    returnWindowDays: d.returnWindowDays,
    isPreorder: d.isPreorder,
    preorderExpectedDate: d.preorderExpectedDate,
    isUpcoming: d.isUpcoming,
    advancePercent: d.advancePercent,
    isPinned: d.isPinned,
    pinBoost: d.pinBoost,
    seoTitle: d.seoTitle ?? '',
    seoDescription: d.seoDescription ?? '',
    attributes,
  };
}

const blank = (s: string) => (s.trim() ? s.trim() : null);

export interface ProductBody {
  titleEn: string;
  titleBn: string | null;
  slug?: string;
  shortDescriptionEn: string | null;
  shortDescriptionBn: string | null;
  descriptionHtmlEn: string | null;
  descriptionHtmlBn: string | null;
  youtubeUrl: string | null;
  brandId: string | null;
  primaryCategoryId: string;
  categoryIds: string[];
  fulfillment: Fulfillment;
  weightG: number | null;
  deliveryChargeOverrideP: number | null;
  returnWindowDays: number | null;
  isPreorder: boolean;
  preorderExpectedDate: string | null;
  isUpcoming: boolean;
  advancePercent: number | null;
  isPinned: boolean;
  pinBoost: number;
  seoTitle: string | null;
  seoDescription: string | null;
  attributes?: AttributePayloadRow[];
}

/**
 * Body for POST/PATCH /products. Money stays in paisa. `attributes` is only sent when the
 * applicable attribute list is known (`attrs` non-null): the API replaces the whole set, so
 * sending it before the list loaded would wipe saved values.
 */
export function buildProductPayload(
  form: ProductForm,
  attrs: readonly CategoryAttribute[] | null,
): ProductBody {
  if (!form.primaryCategoryId) throw new Error('Primary category is required');
  const primary = form.primaryCategoryId;
  const slug = form.slug.trim();
  return {
    titleEn: form.titleEn.trim(),
    titleBn: blank(form.titleBn),
    ...(slug ? { slug } : {}),
    shortDescriptionEn: blank(form.shortEn),
    shortDescriptionBn: blank(form.shortBn),
    descriptionHtmlEn: form.descEn.trim() ? form.descEn : null,
    descriptionHtmlBn: form.descBn.trim() ? form.descBn : null,
    youtubeUrl: blank(form.youtubeUrl),
    brandId: form.brandId,
    primaryCategoryId: primary,
    categoryIds: [...new Set(form.extraCategoryIds.filter((id) => id !== primary))],
    fulfillment: form.fulfillment,
    weightG: form.weightG,
    deliveryChargeOverrideP: form.deliveryChargeOverrideP,
    returnWindowDays: form.returnWindowDays,
    isPreorder: form.isPreorder,
    preorderExpectedDate: form.isPreorder ? form.preorderExpectedDate : null,
    isUpcoming: form.isUpcoming,
    advancePercent: form.advancePercent,
    isPinned: form.isPinned,
    pinBoost: form.isPinned ? form.pinBoost : 0,
    seoTitle: blank(form.seoTitle),
    seoDescription: blank(form.seoDescription),
    ...(attrs ? { attributes: buildAttributePayload(attrs, form.attributes) } : {}),
  };
}

export interface ImageDraft {
  /** Media id: the identity of an image in the editor. */
  mediaId: string;
  url: string;
  thumbUrl: string;
  alt: string;
  /** null = shown for all variants. */
  variantId: string | null;
}

export function imagesFromDetail(d: ProductDetail): ImageDraft[] {
  return [...d.images]
    .sort((a, b) => a.sort - b.sort)
    .map((i) => ({
      mediaId: i.mediaId,
      url: i.url,
      thumbUrl: i.thumbUrl,
      alt: i.alt ?? '',
      variantId: i.variantId,
    }));
}

/** Body for PUT /products/:id/images; a variant that no longer exists falls back to "all variants". */
export function buildImagesPayload(images: readonly ImageDraft[], variantIds: ReadonlySet<string>) {
  return {
    images: images.map((i) => ({
      mediaId: i.mediaId,
      variantId: i.variantId && variantIds.has(i.variantId) ? i.variantId : null,
      alt: blank(i.alt),
    })),
  };
}
