import { StatusBadge } from '@bdc/ui';
import classes from './affiliates.module.css';
import { COMMISSION_STATUS } from './logic';

export function AffiliateStatusBadge({ status }: { status: 'active' | 'suspended' }) {
  return (
    <StatusBadge tone={status === 'active' ? 'ok' : 'danger'}>
      {status === 'active' ? 'Active' : 'Suspended'}
    </StatusBadge>
  );
}

export function CommissionBadge({ status }: { status: string }) {
  const s = COMMISSION_STATUS[status] ?? { label: status, tone: 'muted' as const };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function CodeChip({ code }: { code: string }) {
  return <span className={classes.code}>{code}</span>;
}
