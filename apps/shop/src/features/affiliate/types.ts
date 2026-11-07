import type { components } from '@bdc/api-client';

type S = components['schemas'];
export type AffiliateMe = S['AffiliateMeDto'];
export type AffiliateStats = S['AffiliateStatsDto'];
export type AffiliateCommissions = S['AffiliateMyCommissionListDto'];
export type AffiliateCommission = AffiliateCommissions['items'][number];
export type AffiliatePayouts = S['AffiliateMyPayoutListDto'];
export type AffiliatePayoutDetails = S['AffiliatePayoutDetailsDto'];
export type CommissionStatus = AffiliateCommission['status'];

export type TabId = 'dash' | 'links' | 'pay' | 'details';
export const PAGE_SIZE = 20;
