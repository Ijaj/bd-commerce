import { StatusBadge } from '@bdc/ui';
import { Button } from '@mantine/core';
import { canReceive, PO_STATUS } from './logic';
import type { PoDialog } from './PoDialogs';
import type { PoDetail } from './queries';

/** Status badge, Print, Receive goods and Close PO in the page header of a saved order. */
export function PoHeaderActions({
  po,
  canManage,
  canRecv,
  onDialog,
}: {
  po: PoDetail;
  canManage: boolean;
  canRecv: boolean;
  onDialog: (d: PoDialog) => void;
}) {
  const status = PO_STATUS[po.status];
  return (
    <>
      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      <Button
        component="a"
        href={`/print/po/${po.id}`}
        target="_blank"
        rel="noopener"
        variant="default"
        size="xs"
      >
        Print
      </Button>
      {canRecv && canReceive(po.status) && (
        <Button size="xs" onClick={() => onDialog('receive')}>
          Receive goods
        </Button>
      )}
      {canManage && po.status === 'partially_received' && (
        <Button variant="default" size="xs" onClick={() => onDialog('close')}>
          Close PO
        </Button>
      )}
    </>
  );
}
