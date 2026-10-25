/**
 * Public API shapes (see swarm BRIEF contract). Mirrored by hand until `pnpm api:gen` has the
 * storefront endpoints; swap to `components['schemas'][...]` then.
 */
export type ImageSet = {
  alt: string | null;
  width: number;
  height: number;
  url320: string;
  url640: string;
  url1200: string;
};

export type Badges = {
  isNew: boolean;
  isPreorder: boolean;
  isUpcoming: boolean;
  outOfStock: boolean;
};

export type ProductCard = {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string | null;
  image: ImageSet | null;
  /** Effective price in paisa (sale price while a sale window is active). */
  priceP: number;
  compareAtP: number | null;
  discountPct: number | null;
  /** Set while priceP is a live flash price: the countdown target. */
  flashEndsAt?: string | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  badges: Badges;
};

export type CategoryNode = {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string | null;
  level: number;
  chipColor: string | null;
  image: ImageSet | null;
  icon: ImageSet | null;
  children: CategoryNode[];
};

export type Crumb = { slug: string; nameEn: string; nameBn: string | null };

export type Me = {
  id: string;
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  lang: 'en' | 'bn';
  createdAt: string;
};

export type Localized = { en: string; bn: string };

/** GET /v1/public/site. `contact` is requested on the board; optional until the API returns it. */
export type SiteStatus = {
  maintenance: { enabled: boolean; message: Localized };
  announcement: { text: Localized; link: string | null } | null;
  flags: {
    online_payments_enabled: boolean;
    advance_payments_enabled: boolean;
    preorders_enabled: boolean;
  };
  contact?: { hotline: string; email: string };
};
