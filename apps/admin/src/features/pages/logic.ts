import type { PageCreateInput, PageFull } from './api';

const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? 'http://localhost:3100';

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = ['new', 'edit'];

export interface PageFormValues {
  slug: string;
  titleEn: string;
  titleBn: string;
  bodyHtmlEn: string;
  bodyHtmlBn: string;
  isPublished: boolean;
  showInFooter: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
}

export const EMPTY_PAGE: PageFormValues = {
  slug: '',
  titleEn: '',
  titleBn: '',
  bodyHtmlEn: '',
  bodyHtmlBn: '',
  isPublished: false,
  showInFooter: true,
  sortOrder: 100,
  seoTitle: '',
  seoDescription: '',
};

export function pageToValues(p: PageFull): PageFormValues {
  return {
    slug: p.slug,
    titleEn: p.titleEn,
    titleBn: p.titleBn ?? '',
    bodyHtmlEn: p.bodyHtmlEn ?? '',
    bodyHtmlBn: p.bodyHtmlBn ?? '',
    isPublished: p.isPublished,
    showInFooter: p.showInFooter,
    sortOrder: p.sortOrder,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
  };
}

export function validatePage(v: PageFormValues) {
  const errors: Partial<Record<keyof PageFormValues, string>> = {};
  const slug = v.slug.trim();
  if (!slug) errors.slug = 'Enter a slug';
  else if (slug.length > 60) errors.slug = 'At most 60 characters';
  else if (!SLUG_RE.test(slug)) errors.slug = 'Lowercase letters, digits and single hyphens only';
  else if (RESERVED_SLUGS.includes(slug)) errors.slug = `"${slug}" is reserved`;
  if (!v.titleEn.trim()) errors.titleEn = 'Enter an English title';
  if (!Number.isInteger(v.sortOrder) || v.sortOrder < 0 || v.sortOrder > 9999) {
    errors.sortOrder = 'A whole number from 0 to 9999';
  }
  return errors;
}

export function valuesToBody(v: PageFormValues): PageCreateInput {
  return {
    slug: v.slug.trim(),
    titleEn: v.titleEn.trim(),
    titleBn: v.titleBn.trim() || null,
    bodyHtmlEn: v.bodyHtmlEn || null,
    bodyHtmlBn: v.bodyHtmlBn || null,
    isPublished: v.isPublished,
    showInFooter: v.showInFooter,
    sortOrder: v.sortOrder,
    seoTitle: v.seoTitle.trim() || null,
    seoDescription: v.seoDescription.trim() || null,
  };
}

export const shopPageUrl = (slug: string, lang: 'en' | 'bn' = 'en') =>
  `${SITE_URL}${lang === 'bn' ? '/bn' : ''}/pages/${slug}`;
