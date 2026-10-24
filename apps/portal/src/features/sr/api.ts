// TODO(lead): use generated types after api:gen. Shapes below follow BRIEF "Step 7 SR contract";
// mirrors apps/api/src/sr/sr.dto.ts (agent J); lists are paged {items,total,page,pageSize}.
import { http } from '~/api';

export type ImageSet = {
  alt: string | null;
  width: number;
  height: number;
  url320: string;
  url640: string;
  url1200: string;
};

export interface SrMe {
  staff: { id: string; name: string };
  profile: { area: string | null; commissionBp: number };
  month: {
    month: string;
    pendingCollectionP: number;
    targetP: number;
    soldP: number;
    collectedP: number;
    commissionP: number;
    dueOutstandingP: number;
  };
}

export interface SrProduct {
  variantId: string;
  sku: string;
  titleEn: string;
  titleBn: string | null;
  /** "" when the product has no options. */
  optionsText: string;
  optionsTextBn: string;
  image: ImageSet | null;
  priceP: number;
  available: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SrShop {
  id: string;
  name: string;
  ownerName: string | null;
  phone: string;
  address: string;
  area: string | null;
  isNew: boolean;
  status: 'active' | 'blocked';
  dueBalanceP: number;
  notes: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export type LedgerType = 'sale_due' | 'collection' | 'adjustment';

export interface SrLedgerRow {
  id: string;
  b2bShopId: string;
  shopName: string;
  type: LedgerType;
  /** Signed: sale_due positive, collections negative. */
  amountP: number;
  method: CollectionMethod | null;
  memoNo: string | null;
  /** Collections count only once staff confirm; other rows are always confirmed. */
  confirmed: boolean;
  note: string | null;
  at: string;
}

/** Portal: the ledger holds only this SR's own entries for the shop. */
export interface SrShopDetail extends SrShop {
  ledger: SrLedgerRow[];
}

export type SaleStatus = 'submitted' | 'approved' | 'delivered' | 'rejected' | 'cancelled';

export interface SrSaleSummary {
  id: string;
  memoNo: string;
  status: SaleStatus;
  totalP: number;
  paidAtSaleP: number;
  dueP: number;
  note: string | null;
  submittedAt: string;
  approvedAt: string | null;
  rejectedReason: string | null;
  deliveredAt: string | null;
  shop: { id: string; name: string; phone: string };
  itemCount: number;
}

export interface SrSaleItem {
  id: string;
  variantId: string;
  sku: string;
  titleEn: string;
  titleBn: string | null;
  optionsText: string;
  optionsTextBn: string;
  qty: number;
  unitPriceP: number;
  lineTotalP: number;
}

export interface SrSaleDetail extends SrSaleSummary {
  items: SrSaleItem[];
}

export type CollectionMethod = 'cash' | 'bkash' | 'nagad' | 'bank';

export interface NewSaleBody {
  b2bShopId: string;
  items: { variantId: string; qty: number; unitPriceP: number }[];
  paidAtSaleP: number;
  note?: string;
}

export interface NewShopBody {
  name: string;
  ownerName?: string;
  phone: string;
  address: string;
  area?: string;
}

const base = '/v1/portal/sr';

export const srApi = {
  me: () => http<SrMe>('GET', `${base}/me`),
  products: (q: string) => http<SrProduct[]>('GET', `${base}/products?q=${encodeURIComponent(q)}`),
  /** First 100 shops (API max page size); the portal filters them client-side. */
  shops: () => http<Page<SrShop>>('GET', `${base}/shops?pageSize=100`),
  shop: (id: string) => http<SrShopDetail>('GET', `${base}/shops/${id}`),
  createShop: (body: NewShopBody) => http<SrShop>('POST', `${base}/shops`, body),
  sales: () => http<Page<SrSaleSummary>>('GET', `${base}/sales?pageSize=100`),
  sale: (id: string) => http<SrSaleDetail>('GET', `${base}/sales/${id}`),
  createSale: (body: NewSaleBody) => http<SrSaleDetail>('POST', `${base}/sales`, body),
  cancelSale: (id: string) => http<SrSaleDetail>('POST', `${base}/sales/${id}/cancel`),
  collections: () => http<Page<SrLedgerRow>>('GET', `${base}/collections?pageSize=20`),
  createCollection: (body: {
    b2bShopId: string;
    amountP: number;
    method: CollectionMethod;
    note?: string;
  }) => http<SrLedgerRow>('POST', `${base}/collections`, body),
  memoUrl: (id: string, lang: 'en' | 'bn' = 'en') => `${base}/sales/${id}/memo?lang=${lang}`,
};
