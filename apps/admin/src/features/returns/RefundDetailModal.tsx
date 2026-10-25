import { Alert, Button, Group, Loader, Modal, Stack, Table, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ConfirmAction, ReasonModal } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
import { meQuery } from '~/lib/auth';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { returnsApi } from './api';
import { RefundStatusBadge } from './components';
import { notifyReturnError } from './errors';
import { type RefundDetail, refundQuery, useInvalidateReturns } from './queries';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Table.Tr>
      <Table.Th w={160}>{label}</Table.Th>
      <Table.Td>{children}</Table.Td>
    </Table.Tr>
  );
}

function CompleteModal({
  refund,
  opened,
  onClose,
}: {
  refund: RefundDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateReturns();
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await returnsApi.completeRefund(refund.id, ref.trim() || undefined);
      invalidate();
      notifyOk('Refund marked as paid out');
      setRef('');
      onClose();
    } catch (e) {
      notifyReturnError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Mark refund as paid out" size="sm" centered>
      <Stack>
        <Text size="sm">
          Confirm that {formatPrice(refund.amountP)} went back to the customer
          {refund.method === 'wallet' ? ' (recorded only, there is no wallet ledger yet)' : ''}.
        </Text>
        <TextInput
          label="Payment reference"
          description="Transaction id or note, optional"
          maxLength={120}
          value={ref}
          onChange={(e) => setRef(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Mark paid out
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Detail + approve / reject / complete for one refund. Pass `id` to open, null to close. */
export function RefundDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const canManage = useCan('refunds.manage');
  const canApprove = useCan('refunds.approve');
  const me = useQuery(meQuery);
  const invalidate = useInvalidateReturns();
  const q = useQuery({ ...refundQuery(id ?? ''), enabled: !!id });
  const [action, setAction] = useState<'approve' | 'reject' | 'complete' | null>(null);
  const r = q.data;
  const ownRequest = !!r && !!me.data && r.requestedBy === me.data.id;

  return (
    <Modal opened={!!id} onClose={onClose} title="Refund" size="lg" centered>
      {!r ? (
        <Loader size="sm" />
      ) : (
        <Stack>
          <Table>
            <Table.Tbody>
              <Row label="Status">
                <RefundStatusBadge status={r.status} />
              </Row>
              <Row label="Amount">{formatPrice(r.amountP)}</Row>
              <Row label="Method">
                {r.method === 'wallet' ? 'Wallet credit' : 'Original payment'}
              </Row>
              <Row label="Order">
                <Link to="/orders/$id" params={{ id: r.orderId }}>
                  Open order
                </Link>
                {r.returnId && (
                  <>
                    {' · '}
                    <Link to="/returns/$id" params={{ id: r.returnId }}>
                      Open return
                    </Link>
                  </>
                )}
              </Row>
              <Row label="Requested by">
                {r.requestedByName ?? '-'} · {formatDateTime(r.createdAt)}
              </Row>
              {r.approvedAt && (
                <Row label="Decided by">
                  {r.approvedByName ?? '-'} · {formatDateTime(r.approvedAt)}
                </Row>
              )}
              {r.providerRef && <Row label="Reference">{r.providerRef}</Row>}
              {r.doneAt && <Row label="Paid out">{formatDateTime(r.doneAt)}</Row>}
              {r.note && (
                <Row label="Note">
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {r.note}
                  </Text>
                </Row>
              )}
            </Table.Tbody>
          </Table>
          {r.items.length > 0 && (
            <Text size="sm" c="dimmed">
              Covers {r.items.reduce((s, i) => s + i.qty, 0)} unit(s) across {r.items.length}{' '}
              line(s).
            </Text>
          )}
          {r.method === 'wallet' && (
            <Alert color="gray" variant="light">
              Wallet refunds are only recorded for now. The customer wallet ledger arrives in a
              later step, so nothing is credited automatically.
            </Alert>
          )}
          {r.status === 'pending_approval' && ownRequest && canApprove && (
            <Alert color="yellow" variant="light">
              You requested this refund, so another staff member has to approve it.
            </Alert>
          )}
          <Group justify="flex-end">
            {canApprove && r.status === 'pending_approval' && (
              <Button disabled={ownRequest} onClick={() => setAction('approve')}>
                Approve
              </Button>
            )}
            {canApprove && (r.status === 'pending_approval' || r.status === 'approved') && (
              <Button color="red" variant="light" onClick={() => setAction('reject')}>
                Reject
              </Button>
            )}
            {canManage && r.status === 'approved' && (
              <Button onClick={() => setAction('complete')}>Mark paid out</Button>
            )}
          </Group>
          <ConfirmAction
            opened={action === 'approve'}
            onClose={() => setAction(null)}
            title="Approve refund"
            confirmLabel="Approve"
            onConfirm={async () => {
              await returnsApi.approveRefund(r.id);
              invalidate();
              notifyOk('Refund approved');
            }}
          >
            Approve a refund of {formatPrice(r.amountP)}?
          </ConfirmAction>
          <ReasonModal
            opened={action === 'reject'}
            onClose={() => setAction(null)}
            title="Reject refund"
            confirmLabel="Reject"
            onSubmit={async (reason) => {
              await returnsApi.rejectRefund(r.id, reason);
              invalidate();
              notifyOk('Refund rejected');
            }}
          />
          <CompleteModal
            refund={r}
            opened={action === 'complete'}
            onClose={() => setAction(null)}
          />
        </Stack>
      )}
    </Modal>
  );
}
