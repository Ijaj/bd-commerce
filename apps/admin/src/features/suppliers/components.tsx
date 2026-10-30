import { StatusBadge } from '@bdc/ui';
import { formatPrice } from '~/lib/format';
import classes from './suppliers.module.css';

/** Balance owed: positive = we owe the supplier; negative = the supplier owes us (credit). */
export function Balance({ balanceP }: { balanceP: number }) {
  if (balanceP < 0) return <span className={classes.credit}>Credit {formatPrice(-balanceP)}</span>;
  return <span className={balanceP > 0 ? classes.due : undefined}>{formatPrice(balanceP)}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? 'ok' : 'muted'}>{active ? 'Active' : 'Paused'}</StatusBadge>;
}
