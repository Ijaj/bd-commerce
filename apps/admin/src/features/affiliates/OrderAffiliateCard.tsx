import { KeyValue, SectionCard } from '@bdc/ui';
import { Link } from '@tanstack/react-router';
import { formatPrice } from '~/lib/format';
import { CommissionBadge } from './components';

type Affiliate = {
  id: string;
  code: string;
  displayName: string;
  attribution: 'link' | 'code';
  commission: { status: string; amountP: number } | null;
};

/** Order detail card: who referred the order and the commission it earns. Renders nothing when none. */
export function OrderAffiliateCard({ affiliate }: { affiliate: Affiliate | null | undefined }) {
  if (!affiliate) return null;
  return (
    <SectionCard title="Affiliate">
      <KeyValue
        items={[
          [
            'Affiliate',
            <Link key="l" to="/affiliates/$id" params={{ id: affiliate.id }}>
              {affiliate.displayName} ({affiliate.code})
            </Link>,
          ],
          [
            'Attributed by',
            affiliate.attribution === 'code' ? 'Code typed at checkout' : 'Referral link',
          ],
          [
            'Commission',
            affiliate.commission ? (
              <>
                {formatPrice(affiliate.commission.amountP)}{' '}
                <CommissionBadge status={affiliate.commission.status} />
              </>
            ) : (
              '-'
            ),
          ],
        ]}
      />
    </SectionCard>
  );
}
