import type { components } from '@bdc/api-client';

type Schemas = components['schemas'];

export type ProductList = Schemas['ProductListDto'];
export type ProductListItem = ProductList['items'][number];
export type ProductDetail = Schemas['ProductDetailDto'];
export type ProductStatus = ProductDetail['status'];
export type Fulfillment = ProductDetail['fulfillment'];
export type ProductOption = ProductDetail['options'][number];
export type ProductVariant = ProductDetail['variants'][number];
export type ProductImage = ProductDetail['images'][number];
export type AttributeValueRow = ProductDetail['attributeValues'][number];

export type CategoryNode = Schemas['CategoryDto'];
export type CategoryDetail = Schemas['CategoryDetailDto'];
export type CategoryAttribute = CategoryDetail['attributes'][number];
export type AttributeType = CategoryAttribute['type'];
export type BrandRow = Schemas['BrandDto'];
