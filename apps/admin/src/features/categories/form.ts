import type { MediaDto } from '~/components/ImageUpload';
import type { Category, CategoryInput } from './types';

export interface CategoryFormValues {
  nameEn: string;
  nameBn: string;
  slug: string;
  descriptionEn: string;
  descriptionBn: string;
  image: MediaDto | null;
  icon: MediaDto | null;
  banner: MediaDto | null;
  chipColor: string;
  sort: number | '';
  isActive: boolean;
  showOnHome: boolean;
  returnWindowDays: number | '';
  seoTitle: string;
  seoDescription: string;
}

export function emptyFormValues(): CategoryFormValues {
  return {
    nameEn: '',
    nameBn: '',
    slug: '',
    descriptionEn: '',
    descriptionBn: '',
    image: null,
    icon: null,
    banner: null,
    chipColor: '',
    sort: '',
    isActive: true,
    showOnHome: false,
    returnWindowDays: '',
    seoTitle: '',
    seoDescription: '',
  };
}

const orNull = (s: string) => s.trim() || null;

/** Form values -> API body. `original` switches to update semantics (slug only when changed). */
export function formToInput(
  v: CategoryFormValues,
  opts: { level: number; canSetHome: boolean; original?: Category; parentId?: string | null },
): CategoryInput {
  const slug = v.slug.trim();
  const input: CategoryInput = {
    nameEn: v.nameEn.trim(),
    nameBn: orNull(v.nameBn),
    descriptionEn: orNull(v.descriptionEn),
    descriptionBn: orNull(v.descriptionBn),
    imageMediaId: v.image?.id ?? null,
    iconMediaId: v.icon?.id ?? null,
    bannerMediaId: v.banner?.id ?? null,
    chipColor: orNull(v.chipColor),
    isActive: v.isActive,
    returnWindowDays: v.returnWindowDays === '' ? null : v.returnWindowDays,
    seoTitle: orNull(v.seoTitle),
    seoDescription: orNull(v.seoDescription),
  };
  if (opts.level === 1 && opts.canSetHome) input.showOnHome = v.showOnHome;
  if (v.sort !== '') input.sort = v.sort;
  if (slug && slug !== opts.original?.slug) input.slug = slug;
  if (!opts.original) input.parentId = opts.parentId ?? null;
  return input;
}
